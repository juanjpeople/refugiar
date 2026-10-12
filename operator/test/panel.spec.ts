import { expect, test } from "@playwright/test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:https";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { operatorFixture, TEST_KEY, TEST_TOTP } from "../../server/test/operator-fixture";
import { operatorTotp } from "../../server/src/operator-auth";
import { operatorPage } from "../../server/src/operator-page";

// Navegador real + clave/TOTP + sesión SQLite; datos del panel sintéticos.
// No network, production credentials or authentication bypass in the deployed Worker.
test("panel privado: rechazo, datos, licencia y revocación de identidad", async ({ page }, testInfo) => {
  const { app, env, database } = await operatorFixture();
  async function openSection(name: string) {
    if (testInfo.project.name === "mobile") {
      await page.getByRole("combobox", { name: "Sección del panel" }).click();
      await page.getByRole("option", { name, exact: true }).click();
    } else await page.getByRole("tab", { name, exact: true }).click();
  }
  let writes = 0;
  let unavailable = false;
  let deleted = false;
  const resets: string[] = [];
  app.all("/api/admin/platform/*", async c => {
      const request = c.req.raw;
      if (unavailable) return c.json({ error: "unavailable" }, 503);
      const key = new URL(request.url).pathname.split("/").at(-1)!;
      if (request.method === "DELETE") {
        expect(new URL(request.url).pathname).toBe("/api/admin/platform/users/user-alone");
        expect(await request.json()).toEqual({ confirm: "sola@example.com" });
        deleted = true;
        return c.json({ ok: true });
      }
      if (request.method === "POST" && new URL(request.url).pathname.includes("/reset/")) {
        resets.push(new URL(request.url).pathname);
        return c.json({ ok: true });
      }
      if (request.method === "POST") {
        expect(key).toBe("licenses");
        expect(await request.json()).toMatchObject({ count: 1 });
        writes++;
        return c.json({ licenses: [{ code: "OD-SYNTHETIC-LICENSE" }] });
      }
      if (key === "overview") return c.json({ metrics: { users: 2, households: 1, activeHouseholds: 1, pausedHouseholds: 0, activeSessions: 2, licenses: 1, availableLicenses: 1, openFeedback: 0, pendingNotices: 0 }, risks: [{ type: "recovery-ip", sources: 3, maxCount: 12 }, { type: "many-sessions", email: "risk@example.com", sessions: 7 }], credentials: { operatorConfigured: true, supabaseConfigured: false }, recentAudit: [] });
      if (key === "households") return c.json({ households: [{ id: "house-synthetic", members: 2, status: "active", lastActivityAt: 0, deletionEligible: 0 }] });
      if (key === "licenses") return c.json({ licenses: [{ id: "license-synthetic", note: "Licencia de prueba", used: 0, maxHouseholds: 1, status: "active", expiresAt: null }] });
      if (key === "feedback") return c.json({ feedback: [{ id: "feedback-synthetic", email: null, category: "question", status: "open", message: "Mensaje de ejemplo", createdAt: 0 }] });
      if (key === "notices") return c.json({ notices: [{ householdId: "house-synthetic", daysBeforePause: 7, dueAt: 0, status: "pending", memberEmails: "notice@example.com" }] });
      if (key === "capacity") return c.json({ enforced: true, households: { total: 1, active: 1 }, waiting: 0, photos: { bytes: 0, freeBytes: 1073741824 }, defaults: { opsPerDay: 2000, logBytes: 104857600, photoBytes: 104857600 }, codeDefaults: { opsPerDay: 2000, logBytes: 104857600, photoBytes: 104857600 }, hits: [], overrides: [] });
      if (key === "mail") return c.json({ config: "disabled", counts: {}, usage: { daily: 0, monthly: 0 }, limits: { daily: 100, monthly: 3000 } });
      if (key === "users") return c.json({ users: [
        { id: "synthetic", name: "Persona de prueba", email: "synthetic@example.com", households: 1, activeSessions: 1, lastSessionAt: null, twoFactorEnabled: 1, passkeys: 2, deletable: 0 },
        ...(deleted ? [] : [{ id: "user-alone", name: "Sin casa", email: "sola@example.com", households: 0, activeSessions: 0, lastSessionAt: null, twoFactorEnabled: 0, passkeys: 0, deletable: 1 }]),
      ] });
      return c.json({ [key]: [] });
  });
  const assets = { fetch: async (request: Request) => {
    const path = new URL(request.url).pathname;
    const file = path.endsWith("panel.js") ? "panel.js" : path.endsWith("panel.css") ? "panel.css" : "index.html";
    return new Response(await readFile(`operator-dist/${file}`, "utf8"), { headers: { "Content-Type": file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/html" } });
  } };
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const certDir = await mkdtemp(join(tmpdir(), "refugiar-operator-test-"));
  const keyPath = join(certDir, "key.pem"), certPath = join(certDir, "cert.pem");
  execFileSync(process.env.OPENSSL_BINARY ?? (process.platform === "win32" ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl"), ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=localhost"], { stdio: "ignore", windowsHide: true });
  const server = createServer({ key: await readFile(keyPath), cert: await readFile(certPath) }, async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(",") : value);
      const request = new Request(`https://${incoming.headers.host}${incoming.url}`, { method: incoming.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
      const response = incoming.url?.startsWith("/admin") ? await operatorPage(request, assets) : await app.fetch(request, env);
      // Object.fromEntries deja solo la última Set-Cookie: se pasan todas.
      const responseHeaders: Record<string, string | string[]> = Object.fromEntries(response.headers);
      if (response.headers.getSetCookie().length) responseHeaders["set-cookie"] = response.headers.getSetCookie();
      outgoing.writeHead(response.status, responseHeaders);
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      errors.push(String(error));
      outgoing.writeHead(500).end();
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `https://localhost:${(server.address() as AddressInfo).port}`;
  try {
  env.APP_ORIGIN = base;
  if (testInfo.project.name === "mobile") await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(base + "/admin");
  await expect(page.getByRole("heading", { name: "Acceso de operador" })).toBeVisible();
  await expect(page.getByText("Estado de la plataforma", { exact: true })).toHaveCount(0);
  await expect.poll(() => page.locator("main [style]").evaluateAll(elements => elements.every(el => Number(getComputedStyle(el).opacity) === 1))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("private-login.png") });
  await page.getByLabel("Clave de operador").fill("incorrect-key");
  await page.getByLabel("Código del autenticador").fill("000000");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByText("No se pudo ingresar. Revisá la clave y usá un código nuevo del autenticador.")).toBeVisible();
  await expect(page.getByText("Estado de la plataforma", { exact: true })).toHaveCount(0);
  const step = Math.floor(Date.now() / 30000);
  await page.getByLabel("Clave de operador").fill(TEST_KEY);
  await page.getByLabel("Código del autenticador").fill(await operatorTotp(TEST_TOTP, step));
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByText("Estado de la plataforma", { exact: true })).toBeVisible();
  // Una llave de este dispositivo (autenticador virtual de Chromium, con huella): se suma con un código nuevo.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await openSection("Mi acceso");
  await expect(page.getByText("Todavía no sumaste ninguna llave.")).toBeVisible();
  await page.getByRole("button", { name: "Sumar una llave de este dispositivo", exact: true }).click();
  const addDialog = page.getByRole("dialog");
  await addDialog.getByLabel("Nombre de la llave").fill("Compu de prueba");
  await addDialog.getByLabel("Código del autenticador").fill(await operatorTotp(TEST_TOTP, step + 1));
  await addDialog.getByRole("button", { name: "Sumar una llave de este dispositivo", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Compu de prueba", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await openSection("Casas");
  await expect(page.getByText("Recuperación desde una dirección", { exact: true })).toBeVisible();
  await expect(page.getByText("Varias sesiones abiertas", { exact: true })).toBeVisible();
  await expect(page.locator("pre")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "Activa", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: /1969|1970/ })).toBeVisible();
  const refreshIcon = page.getByRole("button", { name: "Actualizar", exact: true }).locator("svg");
  expect(await refreshIcon.evaluate(el => el.getBoundingClientRect().width)).toBeLessThan(20);
  await openSection("Feedback");
  await expect(page.getByRole("cell", { name: "Consulta", exact: true })).toBeVisible();
  await openSection("Avisos");
  await expect(page.getByRole("cell", { name: "Pendiente", exact: true })).toBeVisible();
  await openSection("Usuarios");
  await expect(page.getByText("synthetic@example.com")).toBeVisible();
  // Acceso de una cuenta: quitar los dos pasos, con confirmación. La contraseña no se toca desde acá.
  await expect(page.getByText("La contraseña no se cambia desde acá", { exact: false })).toBeVisible();
  const syntheticRow = page.getByRole("row", { name: /synthetic@example\.com/ });
  await expect(syntheticRow.getByText("2 llaves")).toBeVisible();
  await syntheticRow.getByRole("button", { name: "Acceso", exact: true }).click();
  await page.getByRole("menuitem", { name: "Quitar dos pasos", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("synthetic@example.com");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect.poll(() => resets).toEqual(["/api/admin/platform/users/synthetic/reset/two-factor"]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Solo se borra una cuenta sin casas, con confirmación.
  await expect(page.getByRole("row", { name: /synthetic@example\.com/ }).getByText("Está o estuvo en una casa")).toBeVisible();
  await page.getByRole("row", { name: /sola@example\.com/ }).getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("sola@example.com");
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page.getByText("sola@example.com")).toHaveCount(0);
  expect(deleted).toBe(true);
  await openSection("Licencias");
  await page.getByRole("button", { name: "Generar licencias", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Generar licencias", exact: true }).click();
  await expect(page.getByText("OD-SYNTHETIC-LICENSE", { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  await page.screenshot({ path: testInfo.outputPath("private-license.png") });
  const refreshed = page.waitForResponse(response => response.url().endsWith("/platform/notices") && response.status() === 200);
  await page.getByRole("button", { name: "Aceptar", exact: true }).click();
  await refreshed;
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Actualizar", exact: true })).not.toHaveClass(/ant-btn-loading/);
  unavailable = true;
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByText("No se pudo completar la consulta u operación")).toBeVisible();
  await expect(page.getByText("Estado de la plataforma", { exact: true })).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "Volver a consultar", exact: true }).click();
  await expect(page.getByText("Estado de la plataforma", { exact: true })).toBeVisible();
  const lightBackground = await page.locator("#root > .ant-app > div").evaluate(el => getComputedStyle(el).backgroundColor);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => page.locator("#root > .ant-app > div").evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(lightBackground);
  await expect(page.getByText("Estado de la plataforma", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(() => page.locator("main [style]").evaluateAll(elements => elements.every(el => Number(getComputedStyle(el).opacity) === 1))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("private-panel-dark.png"), fullPage: true });
  env.OPERATOR_EMAIL = "other@example.com"; // La sesión existe pero se retiró el permiso.
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByText("Sesión privada vencida o acceso no autorizado")).toBeVisible();
  await expect(page.getByText("synthetic@example.com")).toHaveCount(0);
  await expect(page.getByText("OD-SYNTHETIC-LICENSE")).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar sesión privada" }).click();
  await expect(page.getByRole("heading", { name: "Acceso de operador" })).toBeVisible();
  // Con la configuración de antes, la llave entra sola: sin clave ni código.
  env.OPERATOR_EMAIL = "owner@example.com";
  await page.getByRole("button", { name: "Entrar con huella o llave de acceso", exact: true }).click();
  await expect(page.getByText("Estado de la plataforma", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  } finally {
    await testInfo.attach("browser-errors", { body: JSON.stringify(errors), contentType: "application/json" });
    database.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (dirname(resolve(certDir)) !== resolve(tmpdir()) || !basename(certDir).startsWith("refugiar-operator-test-")) throw new Error("Unexpected test certificate directory");
    await rm(certDir, { recursive: true });
  }
});
