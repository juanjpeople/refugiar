import { expect, test, type Page } from "@playwright/test";

const user = { id: "passkey-user", name: "Llave", email: "llave@example.test", twoFactorEnabled: false };
const PASSWORD = "Synthetic test password 123!";
const b64u = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const challenge = () => b64u(crypto.getRandomValues(new Uint8Array(32)));

/** Autenticador virtual de Chromium (huella verificada). `prf`: si da el secreto que abre los datos. */
async function virtualAuthenticator(page: Page, prf: boolean) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", ctap2Version: "ctap2_1", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: prf },
  });
}

/**
 * Solo se simula el transporte: la cuenta, las claves, el cifrado y la llave (autenticador virtual)
 * son los reales de la app. Lo que el servidor guarda queda en estas variables.
 */
function mockServer(page: Page) {
  const state = { signedIn: false, keys: null as Record<string, unknown> | null, credentialId: "", unlock: null as string | null, deleted: [] as string[], sent: [] as unknown[], unexpected: [] as string[] };
  void page.context().route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.slice(4);
    const body = request.method() === "GET" ? null : request.postDataJSON();
    let result: unknown = {};
    if (path === "/auth/sign-up/email") state.signedIn = true;
    else if (path === "/keys") state.keys = body;
    else if (path === "/me") result = { user: state.signedIn ? user : null, keys: state.keys, households: [] };
    else if (path === "/social-providers") result = { providers: [] };
    else if (path === "/auth/list-accounts") result = [];
    else if (path === "/account/devices") result = { devices: [] };
    else if (path === "/account/passkeys") result = { passkeys: state.unlock ? [{ id: "pk-1", name: "Esta compu", createdAt: Date.now(), credentialId: state.credentialId, unlocks: true }] : [] };
    else if (path === "/auth/passkey/generate-register-options") {
      result = {
        challenge: challenge(), rp: { name: "Refugiar", id: "localhost" }, user: { id: b64u(new TextEncoder().encode(user.id)), name: user.email, displayName: user.name },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }], timeout: 60_000, attestation: "none", excludeCredentials: [],
        authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
      };
    } else if (path === "/auth/passkey/verify-registration") {
      state.sent.push(body.response.clientExtensionResults);
      expect(body.password).toHaveLength(43);
      state.credentialId = body.response.id;
      result = { id: "pk-1", credentialID: state.credentialId };
    } else if (path === "/account/passkeys/pk-1/unlock") {
      expect(body.password).toHaveLength(43);
      state.unlock = body.privateKeys;
    } else if (path === "/auth/passkey/delete-passkey") state.deleted.push(body.id);
    else if (path === "/auth/passkey/generate-authenticate-options") result = { challenge: challenge(), rpId: "localhost", allowCredentials: [], userVerification: "preferred", timeout: 60_000 };
    else if (path === "/auth/passkey/verify-authentication") {
      state.sent.push(body.response.clientExtensionResults);
      expect(body.response.id).toBe(state.credentialId);
      state.signedIn = true;
    } else if (path === `/account/passkeys/unlock/${state.credentialId}` && state.unlock) result = { privateKeys: state.unlock };
    else if (path === "/auth/sign-out") state.signedIn = false;
    else {
      state.unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 404, json: { error: "not-found" } });
    }
    await route.fulfill({ json: result });
  });
  return state;
}

async function createAccount(page: Page) {
  await page.goto("/cuenta?modo=crear");
  await page.getByLabel("Tu nombre", { exact: true }).fill(user.name);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Repetí la contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByRole("checkbox", { name: "Guardé mi kit en un lugar seguro" }).check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page).toHaveURL(/\/familia/);
}

async function addPasskey(page: Page) {
  await page.goto("/ajustes");
  await page.getByText("Administrador", { exact: true }).first().click();
  await page.goto("/ajustes#cuenta");
  const passkeys = page.getByRole("group", { name: "Llaves de acceso", exact: true });
  await expect(passkeys.getByText("Todavía no sumaste ninguna.")).toBeVisible();
  await passkeys.getByRole("button", { name: "Sumar una llave", exact: true }).click();
  await passkeys.getByLabel("Nombre de la llave", { exact: true }).fill("Esta compu");
  await passkeys.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await passkeys.getByRole("button", { name: "Sumar una llave", exact: true }).click();
  return passkeys;
}

test("una llave de acceso con PRF entra sin contraseña y abre los datos cifrados", async ({ page }) => {
  const server = mockServer(page);
  await virtualAuthenticator(page, true);
  await createAccount(page);
  const passkeys = await addPasskey(page);
  await expect(page.getByText("Listo: con esta llave entrás sin contraseña.")).toBeVisible();
  await expect(passkeys.getByText("Entra sin contraseña", { exact: true })).toBeVisible();
  expect(server.unlock).toMatch(/^[\w-]+\.[\w-]+$/);
  expect(server.unlock).not.toContain(PASSWORD);

  // Otro arranque, sin sesión ni claves guardadas en el navegador: solo la llave.
  server.signedIn = false;
  await page.goto("/cuenta?modo=entrar");
  await page.evaluate(() => new Promise((resolve) => { const request = indexedDB.deleteDatabase("RefugiarVault"); request.onsuccess = request.onerror = request.onblocked = resolve; }));
  await page.reload();
  await page.getByRole("button", { name: "Entrar con huella o llave de acceso", exact: true }).click();
  await expect(page).toHaveURL(/\/familia/);
  await page.goto("/ajustes#cuenta");
  await expect(page.getByRole("group", { name: user.name, exact: true }).getByText(user.email)).toBeVisible();

  // El secreto de la llave nunca viaja: ni al sumarla ni al entrar.
  expect(server.sent.length).toBeGreaterThanOrEqual(2);
  for (const results of server.sent) expect(JSON.stringify(results)).not.toContain("results");
  expect(server.unexpected).toEqual([]);
});

test("sin PRF y sin dos pasos, la llave no sirve: se quita y se explica", async ({ page }) => {
  const server = mockServer(page);
  await virtualAuthenticator(page, false);
  await createAccount(page);
  await addPasskey(page);
  await expect(page.getByText("Este dispositivo no puede abrir tus datos con una llave de acceso. Entrá con tu contraseña.")).toBeVisible();
  await expect.poll(() => server.deleted).toEqual(["pk-1"]);
  expect(server.unlock).toBeNull();
  expect(server.unexpected).toEqual([]);
});
