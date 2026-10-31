import assert from "node:assert/strict";
import { test } from "node:test";
import { operatorHash, operatorSession, operatorTotp } from "../src/operator-auth";
import { operatorPage } from "../src/operator-page";
import { operatorFixture, TEST_KEY, TEST_TOTP } from "./operator-fixture";
import { softwareAuthenticator } from "./webauthn-fixture";

test("TOTP coincide con todos los vectores SHA-1 de RFC 6238", async () => {
  for (const [time, code] of [[59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"]] as const) assert.equal(await operatorTotp(TEST_TOTP, Math.floor(time / 30), 8), code);
});
test("operador: dos factores, cookies seguras, replay concurrente, revocación, expiración y rotación", async (t) => {
  const { app, env, database } = await operatorFixture(); t.after(() => database.close());
  const headers = { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "X-Refugiar-Operator": "browser" };
  const code = await operatorTotp(TEST_TOTP, Math.floor(Date.now() / 30_000));
  const login = (key = TEST_KEY, otp = code, extra = {}) => app.request(`${env.APP_ORIGIN}/api/admin/auth/login`, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify({ key, code: otp }) }, env);
  assert.equal((await login("cd".repeat(32))).status, 401);
  const wrongCode = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
  assert.equal((await login(TEST_KEY, wrongCode)).status, 401);
  assert.equal((await login(TEST_KEY, code, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await login(TEST_KEY, code, { "Sec-Fetch-Site": "cross-site" })).status, 403);
  const responses = await Promise.all([login(), login()]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 401]);
  const response = responses.find(r => r.status === 200)!;
  const setCookie = response.headers.get("set-cookie")!;
  assert.match(setCookie, /^__Host-od-operator=/); assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /Secure/); assert.match(setCookie, /SameSite=Strict/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const cookie = setCookie.split(";")[0];
  const request = new Request(`${env.APP_ORIGIN}/api/admin/platform/overview`, { headers: { Cookie: cookie } });
  assert.equal(await operatorSession(request, env), "owner@example.com");
  assert.equal(await operatorSession(request, { ...env, OPERATOR_EMAIL: "other@example.com" }), null);
  assert.equal(await operatorSession(request, { ...env, OPERATOR_KEY_HASH: await operatorHash("ef".repeat(32)) }), null);
  assert.equal(await operatorSession(request, { ...env, OPERATOR_TOTP_SECRET: "A".repeat(32) }), null);
  const token = cookie.split("=")[1];
  assert.equal(database.prepare("SELECT token_hash FROM operator_sessions").get()?.token_hash, await operatorHash(token));
  database.exec("UPDATE operator_sessions SET expires_at = 1");
  assert.equal(await operatorSession(request, env), null);
  database.exec(`UPDATE operator_sessions SET expires_at = ${Date.now() + 60000}`);
  assert.equal((await app.request(`${env.APP_ORIGIN}/api/admin/auth/logout`, { method: "POST", headers: { ...headers, Cookie: cookie } }, env)).status, 200);
  assert.equal(await operatorSession(request, env), null);
});
test("sin credenciales no hay acceso; token legado, cuenta doméstica y cabeceras Access no autorizan", async (t) => {
  const { app, env, database } = await operatorFixture(); t.after(() => database.close());
  app.get("/api/admin/platform/overview", c => c.json({ private: true }));
  for (const headers of [{}, { Authorization: `Bearer ${TEST_KEY}` }, { Cookie: "better-auth.session_token=household" }, { "Cf-Access-Jwt-Assertion": "forged", "Cf-Access-Authenticated-User-Email": env.OPERATOR_EMAIL! }] as Record<string, string>[]) {
    assert.equal((await app.request(`${env.APP_ORIGIN}/api/admin/platform/overview`, { headers }, env)).status, 404);
  }
  assert.equal((await app.request(`${env.APP_ORIGIN}/api/admin/auth/session`, { headers: { "X-Refugiar-Operator": "browser" } }, { ...env, OPERATOR_TOTP_SECRET: undefined })).status, 404);
  const request = new Request("https://other.example/api/admin/platform/overview");
  assert.equal(await operatorSession(request, env), null);
});
test("los intentos de ingreso se limitan en D1 y el cuerpo tiene un límite", async (t) => {
  const { app, env, database } = await operatorFixture(); t.after(() => database.close());
  const headers = { Origin: env.APP_ORIGIN, "X-Refugiar-Operator": "browser", "Content-Type": "application/json" };
  for (let i = 0; i < 11; i++) {
    const response = await app.request(`${env.APP_ORIGIN}/api/admin/auth/login`, { method: "POST", headers, body: JSON.stringify({ key: "cd".repeat(32), code: "000000" }) }, env);
    assert.equal(response.status, i < 10 ? 401 : 429);
  }
  assert.equal((await app.request(`${env.APP_ORIGIN}/api/admin/auth/login`, { method: "POST", headers, body: JSON.stringify({ key: "x".repeat(3000) }) }, env)).status, 413);
});
test("panel: otro dominio (www) redirige al origen principal, que es el único que acepta la API", async () => {
  const assets = { fetch: async () => new Response("panel", { headers: { "Content-Type": "text/html" } }) };
  const moved = await operatorPage(new Request("https://www.refugi.ar/admin?x=1"), assets, "https://refugi.ar");
  assert.equal(moved.status, 308);
  assert.equal(moved.headers.get("Location"), "https://refugi.ar/admin?x=1");
  assert.equal((await operatorPage(new Request("https://refugi.ar/admin"), assets, "https://refugi.ar")).status, 200);
  assert.equal((await operatorPage(new Request("http://localhost:8787/admin"), assets, "https://refugi.ar")).status, 200);
});
test("operador: llave de acceso con la sesión y un código nuevo; después entra sola, con huella o PIN", async (t) => {
  const { app, env, database } = await operatorFixture(); t.after(() => database.close());
  const headers = { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "X-Refugiar-Operator": "browser" };
  const step = Math.floor(Date.now() / 30_000);
  /** Cada pedido con sus cookies; devuelve el estado, el cuerpo y las cookies nuevas. */
  async function call(path: string, jar: Map<string, string>, body?: unknown, method = body === undefined ? "GET" : "POST", config = env) {
    const response = await app.request(`${env.APP_ORIGIN}/api/admin/auth${path}`, { method, headers: { ...headers, Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") }, body: body === undefined ? undefined : JSON.stringify(body) }, config);
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const [name, value] = pair.split("=");
      if (/Max-Age=0/.test(cookie)) jar.delete(name); else jar.set(name, value);
    }
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }
  const operator = new Map<string, string>();
  assert.equal((await call("/login", operator, { key: TEST_KEY, code: await operatorTotp(TEST_TOTP, step) })).status, 200);
  assert.deepEqual((await call("/passkeys", operator)).body, { passkeys: [] });

  // Sumar una llave: sin sesión, nada; con sesión, además un código nuevo (el del ingreso ya se usó).
  const key = softwareAuthenticator({ origin: env.APP_ORIGIN, rpId: "app.example" });
  assert.equal((await call("/passkeys/options", new Map(), {})).status, 401);
  const options = await call("/passkeys/options", operator, {});
  assert.equal((options.body.authenticatorSelection as { userVerification: string }).userVerification, "required");
  const response = key.register(options.body.challenge as string);
  assert.equal((await call("/passkeys", operator, { response, code: "12", name: "Celular" })).status, 400);
  assert.equal((await call("/passkeys", operator, { response, code: await operatorTotp(TEST_TOTP, step), name: "Celular" })).status, 401);
  assert.equal((await call("/passkeys", operator, { response, name: "Celular" })).status, 201);
  const listed = (await call("/passkeys", operator)).body.passkeys as { id: string; name: string }[];
  assert.deepEqual(listed.map((entry) => [entry.id, entry.name]), [[key.id, "Celular"]]);

  // Entrar solo con la llave: el desafío sirve una vez y la huella (o el PIN) es obligatoria.
  const phone = new Map<string, string>();
  const login = await call("/passkey/login/options", phone, {});
  assert.equal(login.body.userVerification, "required");
  const challengeCookie = [...phone];
  assert.equal((await call("/passkey/login", phone, { response: key.authenticate(login.body.challenge as string) })).status, 200);
  const phoneToken = phone.get("__Host-od-operator")!;
  const sessionRow = database.prepare("SELECT expires_at FROM operator_sessions WHERE token_hash = ?").get(await operatorHash(phoneToken)) as { expires_at: number };
  assert.ok(sessionRow.expires_at > Date.now() + 6 * 24 * 3600 * 1000);
  const session = new Request(`${env.APP_ORIGIN}/api/admin/platform/overview`, { headers: { Cookie: `__Host-od-operator=${phone.get("__Host-od-operator")}` } });
  assert.equal(await operatorSession(session, env), "owner@example.com");
  assert.equal(phone.has("__Host-od-operator-webauthn"), false);
  assert.equal((await call("/passkey/login", new Map(challengeCookie), { response: key.authenticate(login.body.challenge as string) })).status, 401);
  const untouched = new Map<string, string>();
  const noVerification = await call("/passkey/login/options", untouched, {});
  assert.equal((await call("/passkey/login", untouched, { response: key.authenticate(noVerification.body.challenge as string, { userVerified: false }) })).status, 401);
  const stranger = new Map<string, string>();
  const strangerOptions = await call("/passkey/login/options", stranger, {});
  const other = softwareAuthenticator({ origin: env.APP_ORIGIN, rpId: "app.example" });
  assert.equal((await call("/passkey/login", stranger, { response: other.authenticate(strangerOptions.body.challenge as string) })).status, 401);

  // Si cambia el TOTP o la clave del operador, la llave sigue sirviendo.
  const rotatedTotp = { ...env, OPERATOR_TOTP_SECRET: "A".repeat(32) };
  const later = new Map<string, string>();
  const rotatedOptions = await call("/passkey/login/options", later, {}, "POST", rotatedTotp);
  assert.equal((await call("/passkey/login", later, { response: key.authenticate(rotatedOptions.body.challenge as string) }, "POST", rotatedTotp)).status, 200);

  // Si cambia el correo del operador (otro operador), la llave deja de servir.
  const rotatedEmail = { ...env, OPERATOR_EMAIL: "other@example.com" };
  const otherOperator = new Map<string, string>();
  const otherOptions = await call("/passkey/login/options", otherOperator, {}, "POST", rotatedEmail);
  assert.equal((await call("/passkey/login", otherOperator, { response: key.authenticate(otherOptions.body.challenge as string) }, "POST", rotatedEmail)).status, 401);

  // Quitarla: ya no entra.
  assert.equal((await call(`/passkeys/${key.id}`, later, undefined, "DELETE", rotatedTotp)).status, 200);
  const removed = new Map<string, string>();
  const removedOptions = await call("/passkey/login/options", removed, {}, "POST", rotatedTotp);
  assert.equal((await call("/passkey/login", removed, { response: key.authenticate(removedOptions.body.challenge as string) }, "POST", rotatedTotp)).status, 401);
});

test("métricas anónimas en D1", async (t) => {
  const { database } = await operatorFixture(); t.after(() => database.close());
  const day = new Date().toISOString().slice(0, 10);
  database.exec(`INSERT INTO daily_metrics (day, metric, count) VALUES ('${day}', 'landing', 1) ON CONFLICT(day, metric) DO UPDATE SET count = count + 1`);
  database.exec(`INSERT INTO daily_metrics (day, metric, count) VALUES ('${day}', 'landing', 1) ON CONFLICT(day, metric) DO UPDATE SET count = count + 1`);
  const row = database.prepare("SELECT count FROM daily_metrics WHERE day = ? AND metric = 'landing'").get(day) as { count: number };
  assert.equal(row.count, 2);
});

test("operador: recuperación por correo envía código solo al OPERATOR_EMAIL, abre sesión de 7d y permite sumar passkey", async (t) => {
  const { app, env, database } = await operatorFixture(); t.after(() => database.close());
  const headers = { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "X-Refugiar-Operator": "browser" };
  const sent: { to: string[]; text: string; html: string }[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return Response.json({ id: "re_msg_1" });
  });

  // No acepta ni usa ningún correo externo; ignora email enviado en el body y manda solo a OPERATOR_EMAIL.
  const recoverRes = await app.request(`${env.APP_ORIGIN}/api/admin/auth/recover`, {
    method: "POST", headers, body: JSON.stringify({ email: "attacker@evil.example" }),
  }, env);
  assert.equal(recoverRes.status, 200);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ["owner@example.com"]);
  const match = sent[0].text.match(/\b(\d{6})\b/);
  assert.ok(match, "El correo debe incluir el código de 6 dígitos");
  const code = match[1];
  // El cuerpo en email_outbox queda limpio una vez entregado.
  const outboxRow = database.prepare("SELECT status, body FROM email_outbox").get() as { status: string; body: string };
  assert.equal(outboxRow.status, "sent");
  assert.equal(outboxRow.body, "");

  // Código incorrecto falla; el código correcto abre sesión de 7 días y no puede reutilizarse.
  const wrongCode = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
  assert.equal((await app.request(`${env.APP_ORIGIN}/api/admin/auth/recover/verify`, { method: "POST", headers, body: JSON.stringify({ code: wrongCode }) }, env)).status, 401);
  const verifyRes = await app.request(`${env.APP_ORIGIN}/api/admin/auth/recover/verify`, { method: "POST", headers, body: JSON.stringify({ code }) }, env);
  assert.equal(verifyRes.status, 200);
  assert.equal((await app.request(`${env.APP_ORIGIN}/api/admin/auth/recover/verify`, { method: "POST", headers, body: JSON.stringify({ code }) }, env)).status, 401);

  const sessionCookie = verifyRes.headers.get("set-cookie")!.split(";")[0];
  const sessionReq = new Request(`${env.APP_ORIGIN}/api/admin/platform/overview`, { headers: { Cookie: sessionCookie } });
  assert.equal(await operatorSession(sessionReq, env), "owner@example.com");

  // Con la sesión abierta, un nuevo código por correo también sirve para registrar una Passkey sin TOTP.
  assert.equal((await app.request(`${env.APP_ORIGIN}/api/admin/auth/recover`, { method: "POST", headers }, env)).status, 200);
  const passkeyCode = sent[1].text.match(/\b(\d{6})\b/)![1];
  const optRes = await app.request(`${env.APP_ORIGIN}/api/admin/auth/passkeys/options`, { method: "POST", headers: { ...headers, Cookie: sessionCookie }, body: "{}" }, env);
  assert.equal(optRes.status, 200);
  const challengeCookie = optRes.headers.get("set-cookie")!.split(";")[0];
  const optBody = await optRes.json() as { challenge: string };
  const authenticator = softwareAuthenticator({ origin: env.APP_ORIGIN, rpId: "app.example" });
  const regRes = await app.request(`${env.APP_ORIGIN}/api/admin/auth/passkeys`, {
    method: "POST",
    headers: { ...headers, Cookie: `${sessionCookie}; ${challengeCookie}` },
    body: JSON.stringify({ response: authenticator.register(optBody.challenge), code: passkeyCode, name: "PC Admin" }),
  }, env);
  assert.equal(regRes.status, 201);
});
