import { expect, test } from "./fixtures";

test("el estilo se elige en Ajustes, se recuerda y se puede volver al de siempre", async ({ home: page }, testInfo) => {
  if (testInfo.project.name === "celular") await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/ajustes#apariencia");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-skin", "casa");

  // La vista previa muestra el estilo con el foco sin aplicarlo. El puntero queda afuera: el último
  // toque al elegir perfil podría quedar sobre otra tarjeta y mostrar esa.
  await page.mouse.move(0, 0);
  await page.getByRole("radio", { name: /Océano/ }).focus();
  await expect(page.getByText("Vista previa: Océano", { exact: true })).toBeVisible();
  await expect(html).toHaveAttribute("data-skin", "casa");

  await page.getByRole("radio", { name: /Cálido/ }).click();
  await expect(html).toHaveAttribute("data-skin", "calido");
  // Elegir un estilo aplica su color de marca y su redondeo.
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "14");

  await page.goto("/inventario");
  await expect(html).toHaveAttribute("data-skin", "calido");
  await page.screenshot({ path: testInfo.outputPath("calido.png"), fullPage: true, animations: "disabled" });

  await page.goto("/ajustes#apariencia");
  await page.getByRole("radio", { name: /Sobrio/ }).click();
  await expect(html).toHaveAttribute("data-skin", "sobrio");
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "2");
  await page.goto("/inventario");
  await page.screenshot({ path: testInfo.outputPath("sobrio.png"), fullPage: true, animations: "disabled" });

  await page.goto("/ajustes#apariencia");
  await page.getByRole("radio", { name: /Casa/ }).click();
  await expect(html).toHaveAttribute("data-skin", "casa");
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "8");
});

test("la apariencia rápida cambia el estilo desde el avatar, sin ir a Ajustes", async ({ home: page }) => {
  await page.goto("/inventario");
  const html = page.locator("html");
  await page.getByRole("button", { name: "Cambiar de perfil", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Apariencia rápida" }).click();
  await page.getByRole("radio", { name: /Jardín/ }).click();
  await expect(html).toHaveAttribute("data-skin", "jardin");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("radio", { name: /Jardín/ })).toBeHidden();
  await expect(page).toHaveURL(/\/inventario$/);
});
