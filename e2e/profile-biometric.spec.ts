import { test, expect } from "./fixtures";

test("desbloqueo local: registrar, verificar la firma y conservar PIN de respaldo", async ({ home: page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  await page.goto("/ajustes#desbloqueo");
  await page.getByRole("button", { name: "Configurar mi bloqueo", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Seguridad de Administrador", exact: true });
  await expect(drawer.getByText("Guardá un PIN de respaldo", { exact: false })).toBeVisible();
  await drawer.getByRole("button", { name: "Crear PIN", exact: true }).click();
  for (let round = 0; round < 2; round++) {
    for (const digit of ["1", "2", "3", "4"]) await drawer.getByRole("button", { name: digit, exact: true }).click();
    await drawer.getByRole("button", { name: "OK", exact: true }).click();
  }
  await drawer.getByRole("button", { name: "Registrar este dispositivo", exact: true }).click();
  await expect(drawer.getByText(/Registrada el /)).toBeVisible();
  await page.evaluate(() => sessionStorage.removeItem("refugiar-lock"));
  await page.reload();
  // The virtual platform authenticator signs a fresh challenge; no cloud account or TOTP.
  await expect(page.getByRole("heading", { name: "Ajustes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Configurar mi bloqueo", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Cambiar PIN", exact: true })).toBeVisible();
});

test("desbloqueo local: cancelar biometría no evita el PIN de respaldo", async ({ home: page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  await page.goto("/ajustes#desbloqueo");
  await page.getByRole("button", { name: "Configurar mi bloqueo", exact: true }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: "Crear PIN", exact: true }).click();
  for (let round = 0; round < 2; round++) {
    for (const digit of ["1", "2", "3", "4"]) await drawer.getByRole("button", { name: digit, exact: true }).click();
    await drawer.getByRole("button", { name: "OK", exact: true }).click();
  }
  await drawer.getByRole("button", { name: "Registrar este dispositivo", exact: true }).click();
  await expect(drawer.getByText(/Registrada el /)).toBeVisible();
  await cdp.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: false });
  await page.evaluate(() => sessionStorage.removeItem("refugiar-lock"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hola, Administrador", exact: true })).toBeVisible();
  for (const digit of ["1", "2", "3", "4"]) await page.getByRole("button", { name: digit, exact: true }).click();
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ajustes", exact: true })).toBeVisible();
});
