import { expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFile, rename } from "node:fs/promises";
import path from "node:path";

export async function saveFamily(home, state) {
  // Cada familia conserva su manifiesto aunque después se elija crear otra.
  for (const target of [path.join(home, state.group, "family.json"), path.join(home, "active-family.json")]) {
    await writeFile(`${target}.tmp`, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
    await rename(`${target}.tmp`, target);
  }
}

async function signup(page, account, directory) {
  await page.getByLabel("Tu nombre", { exact: true }).fill(account.name);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(account.password);
  await page.getByLabel("Repetí la contraseña", { exact: true }).fill(account.password);
  const registered = page.waitForResponse((response) => response.url().endsWith("/api/auth/sign-up/email"));
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  const response = await registered;
  if (!response.ok()) throw new Error(`Alta rechazada (${response.status()}); no se modificaron los límites del servidor.`);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar", exact: true }).click();
  await (await downloaded).saveAs(path.join(directory, `${account.slot}-recuperacion.txt`));
  await page.getByRole("checkbox", { name: "Guardé mi kit en un lugar seguro" }).check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}

export async function verifyFamily(pages, origin, householdId, { checkFixture = true } = {}) {
  const userIds = [];
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    await page.goto(`${origin}/inventario`);
    if (checkFixture) {
      await page.getByText("Heladera", { exact: true }).first().click();
      await expect(page.getByRole("button", { name: "Ver detalle de Arroz del laboratorio", exact: true })).toBeVisible({ timeout: 30_000 });
    } else {
      // Al reabrir, el usuario puede haber renombrado o borrado el producto de muestra.
      // Verificar identidad y hogar sin reponer datos ni exigir el inventario inicial.
      await expect(page.getByRole("button", { name: "Cambiar de perfil", exact: true })).toBeVisible({ timeout: 30_000 });
    }
    const response = await page.context().request.get(`${origin}/api/me`);
    const me = await response.json();
    const household = me.households?.find((entry) => entry.id === householdId);
    expect(household?.role).toBe(index < 2 ? "admin" : "kid");
    userIds.push(me.user.id);
    if (index >= 2) {
      await expect(page.getByRole("button", { name: "Agregar producto", exact: true })).toHaveCount(0);
      const denied = await page.context().request.post(`${origin}/api/households/${householdId}/invites`, { headers: { Origin: origin }, data: {} });
      expect(denied.status()).toBe(403);
    }
  }
  expect(new Set(userIds).size).toBe(4);
  const roster = await (await pages[0].context().request.get(`${origin}/api/households/${householdId}/members`)).json();
  if (checkFixture) {
    expect(roster.members.map((member) => member.role).sort()).toEqual(["admin", "admin", "kid", "kid"]);
    expect(roster.members.map((member) => member.userId).sort()).toEqual([...userIds].sort());
  } else {
    expect(roster.members.map((member) => member.userId)).toEqual(expect.arrayContaining(userIds));
  }
  return userIds;
}

/** Alta por UI solamente. No escribe IndexedDB, claves, roles ni tablas del servidor. */
export async function prepareFamily(pages, origin, home, state) {
  if (origin !== "http://localhost:4195") throw new Error("La preparación automática solo está habilitada en el laboratorio local.");
  const directory = path.join(home, state.group);
  const step = async (name) => {
    state.step = name;
    await saveFamily(home, state);
    console.log(`Preparando familia: ${name}`);
  };
  const accounts = [1, 2].map((slot) => ({ slot: `adulto-${slot}`, name: `Adulto ${slot} laboratorio`, email: `adulto-${slot}-${randomUUID()}@example.test`, password: `Familia de prueba ${randomUUID()}!` }));
  await writeFile(path.join(directory, "cuentas-ficticias.json"), JSON.stringify(accounts, null, 2), { flag: "wx", mode: 0o600 });
  const [owner, adult, ...kids] = pages;
  await step("cuenta del adulto 1");
  await owner.goto(`${origin}/cuenta?modo=crear&siguiente=casa`);
  await owner.getByPlaceholder("OD-XXXX-XXXX-XXXX-XXXX").fill("OD-TEST-TEST-TEST-TEST");
  await owner.getByRole("button", { name: "Continuar", exact: true }).click();
  await signup(owner, accounts[0], directory);
  await step("casa e inventario");
  await owner.getByRole("checkbox", { name: "Cocina", exact: true }).check();
  await owner.getByRole("button", { name: "Siguiente", exact: true }).click();
  for (const name of ["Heladera", "Alacena"]) await owner.getByRole("checkbox", { name, exact: true }).check();
  await owner.getByRole("button", { name: "Siguiente", exact: true }).click();
  await owner.getByRole("button", { name: "Siguiente", exact: true }).click();
  await owner.getByRole("button", { name: "Guardar esta selección", exact: true }).click();
  await owner.getByLabel("Nombre de la casa", { exact: true }).fill("Familia del laboratorio");
  await owner.getByRole("button", { name: "Crear mi casa", exact: true }).click();
  await owner.getByRole("button", { name: "Ir a mi casa", exact: true }).click();
  const me = await (await owner.context().request.get(`${origin}/api/me`)).json();
  state.householdId = me.households[0].id;
  await owner.goto(`${origin}/inventario`);
  await owner.getByText("Heladera", { exact: true }).first().click();
  await owner.getByRole("button", { name: "Agregar producto", exact: true }).first().click();
  const item = owner.getByRole("dialog", { name: /^Agregar producto a / });
  await item.getByPlaceholder("Ej. Leche, Taladro, Pilas AA").fill("Arroz del laboratorio");
  await item.getByLabel("Cantidad").fill("3");
  await item.getByLabel("Mínimo").fill("1");
  const uploaded = owner.waitForResponse((response) => response.url().endsWith("/ops") && response.request().method() === "POST" && response.ok());
  await item.getByRole("button", { name: "Agregar", exact: true }).click();
  await uploaded;

  await step("invitación y aprobación del adulto 2");
  await owner.goto(`${origin}/familia`);
  // Esta casa acaba de crearse para el laboratorio. Quitar sus dos perfiles de
  // ejemplo por la UI antes de agregar las cuatro personas reales de la prueba.
  for (const name of ["Adulto", "Explorador"]) {
    const sample = owner.locator(".ant-card").filter({ has: owner.getByRole("heading", { name, exact: true }) });
    await sample.getByRole("button", { name: "Eliminar", exact: true }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(sample).toHaveCount(0);
  }
  await owner.getByRole("button", { name: "Invitar a la familia", exact: true }).click();
  const invite = owner.getByRole("dialog");
  await invite.getByText("Administrador", { exact: true }).click();
  await invite.getByRole("button", { name: "Crear invitación", exact: true }).click();
  const link = await invite.locator("input[readonly]").inputValue();
  await owner.keyboard.press("Escape");
  await adult.goto(link);
  await signup(adult, accounts[1], directory);
  await expect(adult.getByText("Pedido enviado", { exact: true })).toBeVisible();
  await owner.reload();
  const adultApproval = owner.waitForResponse((response) => response.url().includes("/join-requests/") && response.url().endsWith("/approve") && response.request().method() === "POST");
  await owner.getByText(accounts[1].name, { exact: true }).locator("xpath=ancestor::div[.//button[normalize-space()='Aprobar']][1]").getByRole("button", { name: "Aprobar", exact: true }).click();
  expect((await adultApproval).ok()).toBe(true);
  await adult.getByRole("button", { name: /^(Ya me aprobó|Entrar a la casa)$/ }).click();
  await adult.getByRole("button", { name: "Ir a la familia", exact: true }).click();

  for (let index = 0; index < kids.length; index++) {
    await step(`vinculación del chico ${index + 1}`);
    const admin = pages[index], kid = kids[index], name = `Chico ${index + 1} laboratorio`;
    await admin.goto(`${origin}/familia`);
    await admin.getByRole("button", { name: "Agregar miembro", exact: true }).click();
    const member = admin.getByRole("dialog");
    await member.getByLabel("Nombre", { exact: true }).fill(name);
    await member.getByText("Niño", { exact: true }).click();
    await member.getByRole("button", { name: /^(OK|Aceptar)$/ }).click();
    await expect(member).toBeHidden();
    const card = admin.locator(".ant-card").filter({ has: admin.getByRole("heading", { name, exact: true }) });
    await card.getByRole("button", { name: "Vincular su celular", exact: true }).click();
    const device = admin.getByRole("dialog");
    await device.getByRole("button", { name: "Crear el código", exact: true }).click();
    await kid.goto(await device.getByLabel("Link para vincular el celular").inputValue());
    await kid.getByRole("button", { name: "Vincular este celular", exact: true }).click();
    await expect(kid.getByText("Pedido enviado", { exact: true })).toBeVisible();
    const kidApproval = admin.waitForResponse((response) => response.url().includes("/join-requests/") && response.url().endsWith("/approve") && response.request().method() === "POST");
    await device.getByRole("button", { name: "Aprobar", exact: true }).click();
    expect((await kidApproval).ok()).toBe(true);
    await kid.getByRole("button", { name: /^(Ya me aprobó|Entrar a la casa)$/ }).click();
    await kid.getByRole("button", { name: "Ir a la familia", exact: true }).click();
    await expect(device).toBeHidden();
  }
  await step("comprobación de las cuatro sesiones");
  state.userIds = await verifyFamily(pages, origin, state.householdId);
  state.status = "ready";
  state.lastVerifiedAt = new Date().toISOString();
  state.step = "lista";
  await saveFamily(home, state);
  console.log("Familia lista: dos administradores, dos chicos y el mismo inventario. Kits y cuentas ficticias guardados en el directorio de esta familia.");
}
