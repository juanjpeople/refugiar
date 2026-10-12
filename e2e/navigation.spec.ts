import { expect, test } from "./fixtures";

test("cada página carga directo (como desde un marcador)", async ({ home: page }) => {
  for (const [path, title] of [
    ["/inventario", "Inventario"],
    ["/compras", "Casa"],
    ["/recetas", "Recetas"],
    ["/proyectos", "Proyectos"],
    ["/calendario", "Calendario"],
    ["/ajustes", "Ajustes"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 2 }).first()).toContainText(title);
  }
});

test("ajustes abre una sección por vez; el enlace lleva directo y atrás vuelve", async ({ home: page }, testInfo) => {
  const sections = page.getByRole("navigation", { name: "Secciones de ajustes" });
  const data = page.getByRole("heading", { name: "Datos y privacidad", level: 3 });
  await page.goto("/ajustes#datos");
  await expect(data).toBeVisible();
  await expect(page.getByText("Idioma de la interfaz", { exact: true })).toHaveCount(0);

  // En el celular, la sección ocupa la pantalla: volver muestra la lista.
  if (testInfo.project.name === "celular") await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await sections.getByRole("button", { name: /^Idioma/ }).click();
  await expect(page).toHaveURL(/#idioma$/);
  await expect(page.getByText("Idioma de la interfaz", { exact: true })).toBeVisible();

  await page.goBack();
  if (testInfo.project.name === "celular") await expect(sections.getByRole("button", { name: /^Datos y privacidad/ })).toBeVisible();
  else await expect(data).toBeVisible();
});

test("los QR impresos (/c/<código>) y las URLs viejas llevan al contenedor", async ({ home: page }) => {
  await page.goto("/inventario");
  await page.getByText("Heladera", { exact: true }).first().click();
  await page.waitForURL(/inventario\/ver\?id=/);
  const id = new URL(page.url()).searchParams.get("id")!;
  const code = (await page.getByText(/Código [A-Z0-9]{4}/).innerText()).match(/Código ([A-Z0-9]{4})/)![1];

  await page.goto(`/c/${code}`);
  await expect(page).toHaveURL(/inventario\/ver\?id=/);
  await expect(page.getByRole("heading", { name: "Heladera", exact: true })).toBeVisible();

  await page.goto(`/inventario/${id}`);
  await expect(page).toHaveURL(new RegExp(`inventario/ver\\?id=${id}`));

  await page.goto("/no-existe");
  await expect(page.getByText("No encontramos esta página")).toBeVisible();
});

test("el idioma se cambia desde el header", async ({ home: page }, testInfo) => {
  test.skip(testInfo.project.name === "celular", "En el celular va en el menú del perfil");
  await page.goto("/inventario");
  await page.getByRole("button", { name: "Idioma" }).click();
  await page.getByText("English", { exact: true }).click();
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Inventory");
});
