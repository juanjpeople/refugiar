import { chromium, expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { addItem } from "./fixtures";

const origin = "http://localhost:4195";

async function quantity(page: Page, name: string, value: number) {
  const detail = page.getByRole("button", { name: `Ver detalle de ${name}`, exact: true });
  if (value === 0) {
    // Al recargar, la lista vuelve a ocultar agotados por defecto.
    await expect(async () => {
      const reveal = page.getByRole("button", { name: "Mostrar", exact: true });
      if (await reveal.isVisible()) await reveal.click();
      await expect(detail).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 20_000 });
  }
  await detail.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("group", { name: "Cantidad", exact: true }).getByText(String(value), { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("dos adultos consumen offline; cerrar un navegador conserva el pendiente y ambos convergen sin duplicar", async ({ request }, info) => {
  expect((await (await request.get(`${origin}/build-info.json`)).json()).family).toBe(true);
  const state = JSON.parse(await readFile(".family-lab/local/active-family.json", "utf8"));
  expect(state.status, "Preparar antes la familia con npm run local:family").toBe("ready");
  expect(state.group).toMatch(/^family-[a-f0-9-]+$/);
  const accounts = JSON.parse(await readFile(path.join(".family-lab/local", state.group, "cuentas-ficticias.json"), "utf8")) as { email: string; password: string }[];
  // Perfiles exclusivos de esta prueba: nunca abrimos los cuatro perfiles manuales.
  const launch = async (index: number, offline = false) => {
    const context = await chromium.launchPersistentContext(info.outputPath(`adult-${index}`), {
      channel: "chrome", headless: true, locale: "es-AR", baseURL: origin, offline,
    });
    context.setDefaultTimeout(20_000);
    return context;
  };
  const contexts = [await launch(0), await launch(1)];
  try {
    let pages = contexts.map((context) => context.pages()[0]);
    for (const [index, page] of pages.entries()) {
      await page.goto(`${origin}/cuenta?modo=entrar`);
      await page.getByLabel("Email", { exact: true }).fill(accounts[index].email);
      await page.getByLabel("Contraseña", { exact: true }).fill(accounts[index].password);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await page.getByRole("button", { name: "Ir a mi casa", exact: true }).click();
      const me = await (await contexts[index].request.get(`${origin}/api/me`)).json();
      expect(me.user.id).toBe(state.userIds[index]);
      expect(me.households.find((house: { id: string }) => house.id === state.householdId)?.role).toBe("admin");
    }
    const name = `Consumos offline ${crypto.randomUUID()}`;
    const uploaded = pages[0].waitForResponse((response) => response.url().endsWith("/ops") && response.request().method() === "POST" && response.ok());
    await addItem(pages[0], "Alacena", name, 3, 1);
    await uploaded;
    await pages[1].goto("/inventario");
    await pages[1].getByText("Alacena", { exact: true }).first().click();
    for (const page of pages) {
      await quantity(page, name, 3);
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
      await page.reload();
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    }
    // Las dos copias parten de 3. Cada adulto consume una unidad sin ver al otro.
    await Promise.all(contexts.map((context) => context.setOffline(true)));
    for (const page of pages) {
      await page.getByRole("button", { name: `Usé uno de ${name}`, exact: true }).click();
      await quantity(page, name, 2);
    }
    const url = pages[0].url();
    await contexts[0].close();
    contexts[0] = await launch(0, true);
    pages = contexts.map((context) => context.pages()[0]);
    await pages[0].goto(url);
    await quantity(pages[0], name, 2);
    await contexts[1].setOffline(false);
    await contexts[0].setOffline(false);
    for (const page of pages) await quantity(page, name, 1);
    // Otro arranque fuerza una nueva lectura y no debe volver a aplicar consumos.
    for (const page of pages) {
      await page.reload();
      await quantity(page, name, 1);
    }
    // Invalidar únicamente la sesión remota mediante el servidor real, sin ejecutar
    // el cierre local de la app. Equivale a encontrar una sesión ya no válida.
    expect((await contexts[0].request.post(`${origin}/api/auth/sign-out`, {
      data: {}, headers: { Origin: origin },
    })).ok()).toBe(true);
    expect((await (await contexts[0].request.get(`${origin}/api/me`)).json()).user).toBeNull();
    expect((await contexts[0].request.get(`${origin}/api/households/${state.householdId}/ops?since=0`)).status()).toBe(401);
    await pages[0].reload();
    await quantity(pages[0], name, 1);
    await pages[0].getByRole("button", { name: `Usé uno de ${name}`, exact: true }).click();
    await quantity(pages[0], name, 0);
    await pages[0].reload();
    await quantity(pages[0], name, 0);
    // El otro adulto aún ve el valor confirmado por el servidor.
    await pages[1].reload();
    await quantity(pages[1], name, 1);
    await pages[0].goto("/cuenta?modo=entrar");
    await pages[0].getByLabel("Email", { exact: true }).fill(accounts[0].email);
    await pages[0].getByLabel("Contraseña", { exact: true }).fill(accounts[0].password);
    await pages[0].getByRole("button", { name: "Entrar", exact: true }).click();
    await pages[0].waitForURL((target) => target.pathname === "/");
    await pages[0].goto(url);
    for (const page of pages) await quantity(page, name, 0);
    for (const page of pages) {
      await page.reload();
      await quantity(page, name, 0);
    }
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});
