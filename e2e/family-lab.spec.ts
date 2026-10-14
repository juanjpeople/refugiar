import { expect, test } from "@playwright/test";
import { selectTestSpaces } from "./fixtures";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const restartFixture = path.resolve(".family-lab/local/photo-restart.json");
const afterRestart = process.env.FAMILY_AFTER_RESTART === "1";

test("API real local: alta, casa cifrada y segundo navegador recuperan el inventario", async ({ page, browser, request }) => {
  test.skip(afterRestart, "La fase posterior al reinicio usa la casa ya preparada");
  const build = await (await request.get("/build-info.json")).json();
  expect(build.family).toBe(true);
  const email = `family-${crypto.randomUUID()}@example.test`;
  const password = `Familia de prueba ${crypto.randomUUID()}!`;
  await page.goto("/cuenta?modo=crear&siguiente=casa");
  await page.getByPlaceholder("OD-XXXX-XXXX-XXXX-XXXX").fill("OD-TEST-TEST-TEST-TEST");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Tu nombre", { exact: true }).fill("Adulto de prueba local");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repetí la contraseña", { exact: true }).fill(password);
  const signup = page.waitForResponse((response) => response.url().endsWith("/api/auth/sign-up/email"));
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  expect((await signup).status(), "Alta real: revisar límite de intentos si devuelve 429").toBe(200);
  await page.getByRole("checkbox", { name: "Guardé mi kit en un lugar seguro" }).check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await selectTestSpaces(page);
  await page.getByLabel("Nombre de la casa", { exact: true }).fill("Familia API real");
  const uploaded = page.waitForResponse((response) => response.url().endsWith("/ops") && response.request().method() === "POST" && response.ok());
  await page.getByRole("button", { name: "Crear mi casa", exact: true }).click();
  const ack = await (await uploaded).json();
  expect(ack.acks.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Ir a mi casa", exact: true }).click();
  await page.goto("/inventario");
  await page.getByText("Heladera", { exact: true }).first().click();
  await page.getByRole("button", { name: "Agregar una cosa", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: /^Agregar una cosa a / });
  await dialog.getByPlaceholder("Ej. Leche, Taladro, Pilas AA").fill("Arroz del laboratorio");
  await dialog.getByLabel("Cantidad").fill("3");
  await dialog.getByLabel("Mínimo").fill("1");
  const itemUploaded = page.waitForResponse((response) => response.url().endsWith("/ops") && response.request().method() === "POST" && response.ok());
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
  const itemResponse = await itemUploaded;
  expect(itemResponse.request().postData()).not.toContain("Arroz del laboratorio");
  await expect(page.getByRole("button", { name: "Ver detalle de Arroz del laboratorio", exact: true })).toBeVisible();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 240;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#c7975a"; ctx.fillRect(0, 0, 400, 240);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const photoUploaded = page.waitForResponse((response) => /\/photos\/[^/]+\/thumb$/.test(response.url()) && response.request().method() === "PUT" && response.ok());
  await page.locator('input[type="file"]').setInputFiles({ name: "familia.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  const photoUrl = (await photoUploaded).url();
  const cipher = await page.context().request.get(photoUrl);
  expect(cipher.ok()).toBe(true);
  const cipherHash = createHash("sha256").update(await cipher.body()).digest("hex");
  const second = await browser.newContext({ locale: "es-AR" });
  try {
    const other = await second.newPage();
    await other.goto("http://localhost:4195/cuenta?modo=entrar");
    expect((await (await second.request.get("http://localhost:4195/api/me")).json()).user).toBeNull();
    await other.getByLabel("Email", { exact: true }).fill(email);
    await other.getByLabel("Contraseña", { exact: true }).fill(password);
    await other.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(other.getByRole("button", { name: "Ir a mi casa", exact: true })).toBeVisible();
    await other.getByRole("button", { name: "Ir a mi casa", exact: true }).click();
    await other.goto("http://localhost:4195/inventario");
    await other.getByText("Heladera", { exact: true }).first().click();
    await expect(other.getByRole("button", { name: "Ver detalle de Arroz del laboratorio", exact: true })).toBeVisible();
    await expect(other.locator(".od-photo-tile img")).toHaveJSProperty("naturalWidth", 400);
    // En PC la interfaz offline depende de instalar el service worker; Android la
    // trae dentro del APK. Esperar su instalación antes de cortar la red.
    await other.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await other.reload();
    await other.waitForFunction(() => !!navigator.serviceWorker.controller);
    await expect(other.getByRole("button", { name: "Ver detalle de Arroz del laboratorio", exact: true })).toBeVisible();
    await second.setOffline(true);
    await other.reload();
    await expect(other.getByRole("button", { name: "Ver detalle de Arroz del laboratorio", exact: true })).toBeVisible();
  } finally { await second.close(); }
  // Credenciales exclusivamente ficticias del laboratorio, en carpeta ignorada.
  await writeFile(restartFixture, JSON.stringify({ email, password, photoUrl, cipherHash }), { mode: 0o600 });
});

test("después de reiniciar: navegador nuevo recupera foto cifrada y casa", async ({ page, request }) => {
  test.skip(!afterRestart, "Detener y arrancar el servidor antes de esta fase");
  expect((await (await request.get("/build-info.json")).json()).family).toBe(true);
  const fixture = JSON.parse(await readFile(restartFixture, "utf8")) as { email: string; password: string; photoUrl: string; cipherHash: string };
  expect(new URL(fixture.photoUrl).origin).toBe("http://localhost:4195");
  expect((await request.get(fixture.photoUrl)).status()).toBe(401);
  await page.goto("/cuenta?modo=entrar");
  await page.getByLabel("Email", { exact: true }).fill(fixture.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "Ir a mi casa", exact: true }).click();
  const cipher = await page.context().request.get(fixture.photoUrl);
  expect(cipher.ok()).toBe(true);
  expect(createHash("sha256").update(await cipher.body()).digest("hex")).toBe(fixture.cipherHash);
  await page.goto("/inventario");
  await page.getByText("Heladera", { exact: true }).first().click();
  await expect(page.locator(".od-photo-tile img")).toHaveJSProperty("naturalWidth", 400);
  await expect(page.getByRole("button", { name: "Ver detalle de Arroz del laboratorio", exact: true })).toBeVisible();
});
