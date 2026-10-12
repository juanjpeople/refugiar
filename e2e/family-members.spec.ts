import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function enter(page: Page, email: string, password: string) {
  await page.goto("http://localhost:4195/cuenta?modo=entrar");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "Ir a mi casa", exact: true }).click();
}

test("dos administradores y dos dispositivos infantiles ingresan con aprobación real", async ({ page, browser, request }) => {
  expect((await (await request.get("/build-info.json")).json()).family).toBe(true);
  const fixture = JSON.parse(await readFile(".family-lab/local/photo-restart.json", "utf8")) as { email: string; password: string };
  await enter(page, fixture.email, fixture.password);
  await page.goto("/familia");
  const me = await (await page.context().request.get("http://localhost:4195/api/me")).json();
  const householdId = me.households[0].id as string;
  expect(me.households[0].role).toBe("admin");
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ locale: "es-AR" })));
  try {
    await page.getByRole("button", { name: "Invitar a la familia", exact: true }).click();
    const invite = page.getByRole("dialog");
    await invite.getByText("Administrador", { exact: true }).click();
    await expect(invite.getByRole("radio", { name: "Administrador", exact: true })).toBeChecked();
    await invite.getByRole("button", { name: "Crear invitación", exact: true }).click();
    const link = await invite.locator("input[readonly]").inputValue();
    await page.keyboard.press("Escape");
    const adult = await contexts[0].newPage();
    await adult.goto(link);
    const adultName = `Admin ${crypto.randomUUID().slice(0, 8)}`;
    await adult.getByLabel("Tu nombre", { exact: true }).fill(adultName);
    await adult.getByLabel("Email", { exact: true }).fill(`adult-${crypto.randomUUID()}@example.test`);
    const password = `Segundo adulto ${crypto.randomUUID()}!`;
    await adult.getByLabel("Contraseña", { exact: true }).fill(password);
    await adult.getByLabel("Repetí la contraseña", { exact: true }).fill(password);
    const signup = adult.waitForResponse((response) => response.url().endsWith("/api/auth/sign-up/email"));
    await adult.getByRole("button", { name: "Crear cuenta", exact: true }).click();
    expect((await signup).status(), "Alta real: revisar límite de intentos si devuelve 429").toBe(200);
    await adult.getByRole("checkbox", { name: "Guardé mi kit en un lugar seguro" }).check();
    await adult.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(adult.getByText("Pedido enviado", { exact: true })).toBeVisible();
    const pending = await (await contexts[0].request.get("http://localhost:4195/api/me")).json();
    expect(pending.households).toHaveLength(0);
    const denied = await contexts[0].request.get(`http://localhost:4195/api/households/${householdId}/ops`);
    // El servidor oculta la existencia de casas a quien todavía no es miembro.
    expect(denied.status()).toBe(404);
    expect(await denied.json()).toEqual({ error: "not-found" });
    await page.reload();
    const adultApproval = page.waitForResponse((response) => response.url().includes("/join-requests/") && response.url().endsWith("/approve") && response.request().method() === "POST");
    await page.getByText(adultName, { exact: true }).locator("xpath=ancestor::div[.//button[normalize-space()='Aprobar']][1]").getByRole("button", { name: "Aprobar", exact: true }).click();
    expect((await adultApproval).ok()).toBe(true);
    await adult.getByRole("button", { name: /^(Ya me aprobó|Entrar a la casa)$/ }).click();
    await adult.getByRole("button", { name: "Ir a la familia", exact: true }).click();
    await adult.goto("http://localhost:4195/familia");
    await expect(adult.getByRole("button", { name: "Agregar miembro", exact: true })).toBeVisible();
    const secondMe = await (await contexts[0].request.get("http://localhost:4195/api/me")).json();
    expect(secondMe.households.find((house: { id: string }) => house.id === householdId).role).toBe("admin");
    const userIds = [me.user.id, secondMe.user.id];

    for (let index = 0; index < 2; index++) {
      // Cada adulto crea y aprueba un dispositivo: ambos ejercen administración real.
      const admin = index === 0 ? page : adult;
      await admin.goto("http://localhost:4195/familia");
      const name = `Chico ${index + 1} ${crypto.randomUUID().slice(0, 6)}`;
      await admin.getByRole("button", { name: "Agregar miembro", exact: true }).click();
      const member = admin.getByRole("dialog");
      await member.getByLabel("Nombre", { exact: true }).fill(name);
      await member.getByText("Niño", { exact: true }).click();
      await expect(member.getByRole("radio", { name: "Niño", exact: true })).toBeChecked();
      await member.getByRole("button", { name: /^(OK|Aceptar)$/ }).click();
      await expect(member).toBeHidden();
      const card = admin.locator(".ant-card").filter({ has: admin.getByRole("heading", { name, exact: true }) });
      await card.getByRole("button", { name: "Vincular su celular", exact: true }).click();
      const device = admin.getByRole("dialog");
      await device.getByRole("button", { name: "Crear el código", exact: true }).click();
      const deviceLink = await device.getByLabel("Link para vincular el celular").inputValue();
      const kid = await contexts[index + 1].newPage();
      await kid.goto(deviceLink);
      await kid.getByRole("button", { name: "Vincular este celular", exact: true }).click();
      await expect(kid.getByText("Pedido enviado", { exact: true })).toBeVisible();
      expect((await (await contexts[index + 1].request.get("http://localhost:4195/api/me")).json()).households).toHaveLength(0);
      const kidApproval = admin.waitForResponse((response) => response.url().includes("/join-requests/") && response.url().endsWith("/approve") && response.request().method() === "POST");
      await device.getByRole("button", { name: "Aprobar", exact: true }).click();
      expect((await kidApproval).ok()).toBe(true);
      await kid.getByRole("button", { name: /^(Ya me aprobó|Entrar a la casa)$/ }).click();
      await kid.getByRole("button", { name: "Ir a la familia", exact: true }).click();
      // Al sincronizarse userId, la tarjeta deja de ofrecer vincular y desmonta el modal.
      await expect(device).toBeHidden();
      const kidMe = await (await contexts[index + 1].request.get("http://localhost:4195/api/me")).json();
      expect(kidMe.households.find((house: { id: string }) => house.id === householdId).role).toBe("kid");
      userIds.push(kidMe.user.id);
      const forbidden = await contexts[index + 1].request.post(`http://localhost:4195/api/households/${householdId}/invites`, { headers: { Origin: "http://localhost:4195" }, data: {} });
      expect(forbidden.status()).toBe(403);
      await kid.goto("http://localhost:4195/familia");
      await expect(kid.getByRole("button", { name: "Agregar miembro", exact: true })).toHaveCount(0);
      await kid.goto("http://localhost:4195/inventario");
      await kid.getByText("Heladera", { exact: true }).first().click();
      await expect(kid.getByRole("button", { name: "Ver detalle de Arroz del laboratorio", exact: true })).toBeVisible();
      await expect(kid.getByRole("button", { name: "Agregar producto", exact: true })).toHaveCount(0);
    }
    expect(new Set(userIds).size).toBe(4);
  } finally { await Promise.all(contexts.map((context) => context.close())); }
});
