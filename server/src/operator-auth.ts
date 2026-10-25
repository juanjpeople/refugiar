import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { AppEnv } from "./env";

export interface OperatorConfig {
  APP_ORIGIN: string;
  OPERATOR_EMAIL?: string;
  OPERATOR_KEY_HASH?: string;
  OPERATOR_TOTP_SECRET?: string;
}
const COOKIE = "__Host-od-operator";
const LOCAL_COOKIE = "od-operator-local";
const CHALLENGE_COOKIE = "__Host-od-operator-webauthn";
const LOCAL_CHALLENGE_COOKIE = "od-operator-webauthn-local";
const HOUR = 3_600_000;
const CHALLENGE_MINUTES = 5;

export function operatorConfigured(env: OperatorConfig): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.OPERATOR_EMAIL ?? "") &&
    /^[a-f0-9]{64}$/.test(env.OPERATOR_KEY_HASH ?? "") && /^[A-Z2-7]{32}$/.test(env.OPERATOR_TOTP_SECRET ?? "");
}
export async function operatorHash(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function equal(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
/** RFC 6238, SHA-1, período 30 s. El secreto aleatorio tiene 160 bits (base32). */
export async function operatorTotp(secret: string, step: number, digits = 6): Promise<string> {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  if (!/^[A-Z2-7]{32}$/.test(secret)) throw new Error("Invalid TOTP configuration");
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const character of secret) {
    value = (value << 5) | alphabet.indexOf(character); bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); }
  }
  const counter = new ArrayBuffer(8);
  new DataView(counter).setBigUint64(0, BigInt(step));
  const key = await crypto.subtle.importKey("raw", new Uint8Array(bytes), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
  const offset = mac[mac.length - 1] & 15;
  const number = new DataView(mac.buffer).getUint32(offset) & 0x7fffffff;
  return String(number % (10 ** digits)).padStart(digits, "0");
}
async function configurationHash(env: OperatorConfig) {
  return operatorHash(JSON.stringify([env.APP_ORIGIN, env.OPERATOR_EMAIL, env.OPERATOR_KEY_HASH, env.OPERATOR_TOTP_SECRET]));
}
export async function passkeyOwnerHash(env: OperatorConfig) {
  return operatorHash(JSON.stringify([env.APP_ORIGIN, env.OPERATOR_EMAIL]));
}
export function operatorOriginAllowed(request: Request, env: OperatorConfig): boolean {
  const url = new URL(request.url);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  return (url.protocol === "https:" || local) && url.origin === env.APP_ORIGIN;
}
const secure = (request: Request) => new URL(request.url).protocol === "https:";
function cookieName(request: Request) { return secure(request) ? COOKIE : LOCAL_COOKIE; }
function challengeCookieName(request: Request) { return secure(request) ? CHALLENGE_COOKIE : LOCAL_CHALLENGE_COOKIE; }
function cookie(request: Request, token: string, maxAge: number, name = cookieName(request)) {
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure(request) ? "; Secure" : ""}`;
}
function readCookie(request: Request, name: string): string | null {
  const value = request.headers.get("Cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.split("=")[1];
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
function sessionToken(request: Request): string | null {
  return readCookie(request, cookieName(request));
}
export async function operatorSession(request: Request, env: AppEnv["Bindings"]): Promise<string | null> {
  if (!operatorConfigured(env) || !operatorOriginAllowed(request, env)) return null;
  const token = sessionToken(request);
  if (!token) return null;
  const row = await env.DB.prepare("SELECT token_hash FROM operator_sessions WHERE token_hash = ? AND config_hash = ? AND expires_at > ?")
    .bind(await operatorHash(token), await configurationHash(env), Date.now()).first();
  return row ? env.OPERATOR_EMAIL! : null;
}
/** Obligatorio incluso en GET: otros sitios no pueden usar una cookie del operador. */
export function operatorRequestAllowed(request: Request, env: OperatorConfig): boolean {
  if (!operatorOriginAllowed(request, env) || request.headers.get("X-Refugiar-Operator") !== "browser") return false;
  const site = request.headers.get("Sec-Fetch-Site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("Origin");
  return ["GET", "HEAD"].includes(request.method) ? (!origin || origin === env.APP_ORIGIN) : origin === env.APP_ORIGIN;
}
async function limited(env: AppEnv["Bindings"], key: string, max: number) {
  const now = Date.now(), cutoff = now - 15 * 60_000;
  const row = await env.DB.prepare(`INSERT INTO attempts (key, count, window_start) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start < ? THEN 1 ELSE count + 1 END,
    window_start = CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END RETURNING count`)
    .bind(key, now, cutoff, cutoff).first<{ count: number }>();
  return !row || row.count > max;
}
/** Una cantidad fija de buckets evita crecimiento ilimitado por direcciones IP inventadas. */
async function ipLimited(c: Context<AppEnv>) {
  const ip = await operatorHash(c.req.header("CF-Connecting-IP") ?? "local");
  return limited(c.env, `operator:ip:${ip.slice(0, 3)}`, 10);
}
/**
 * El código del autenticador, de un solo uso. CAS en D1: un código no sirve dos veces, ni con
 * peticiones concurrentes. Solo quien ya pasó la clave (o tiene sesión) llega a gastar este cupo.
 */
async function consumeTotp(env: AppEnv["Bindings"], code: string): Promise<boolean> {
  const current = Math.floor(Date.now() / 30_000);
  let accepted: number | null = null;
  for (const step of [current - 1, current, current + 1]) {
    if (equal(await operatorTotp(env.OPERATOR_TOTP_SECRET!, step), code)) accepted = step;
  }
  if (accepted === null) return false;
  const used = await env.DB.prepare(`INSERT INTO operator_totp (config_hash, last_step) VALUES (?, ?)
    ON CONFLICT(config_hash) DO UPDATE SET last_step = excluded.last_step WHERE last_step < excluded.last_step RETURNING last_step`)
    .bind(await configurationHash(env), accepted).first();
  return Boolean(used);
}
export const SEVEN_DAYS = 7 * 24 * HOUR;

/** Abre la sesión del operador. De paso limpia lo que quedó de otra configuración o venció. */
async function startSession(c: Context<AppEnv>, extraCookies: string[] = [], ttlMs = HOUR) {
  const config = await configurationHash(c.env);
  const owner = await passkeyOwnerHash(c.env);
  const token = randomToken();
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM operator_sessions WHERE expires_at <= ? OR config_hash != ?").bind(now, config),
    c.env.DB.prepare("DELETE FROM operator_totp WHERE config_hash != ?").bind(config),
    c.env.DB.prepare("DELETE FROM operator_passkeys WHERE config_hash != ? AND config_hash != ?").bind(config, owner),
    c.env.DB.prepare("DELETE FROM operator_challenges WHERE expires_at <= ? OR config_hash != ?").bind(now, config),
    c.env.DB.prepare("INSERT INTO operator_sessions (token_hash, config_hash, expires_at) VALUES (?, ?, ?)").bind(await operatorHash(token), config, now + ttlMs),
  ]);
  c.header("Set-Cookie", cookie(c.req.raw, token, Math.floor(ttlMs / 1000)));
  for (const extra of extraCookies) c.header("Set-Cookie", extra, { append: true });
  return c.json({ email: c.env.OPERATOR_EMAIL });
}

// --- Llaves de acceso (WebAuthn) ------------------------------------------------------------

const rpID = (env: OperatorConfig) => new URL(env.APP_ORIGIN).hostname;
/** Guarda el desafío (de un solo uso) y deja su token en una cookie. */
async function saveChallenge(c: Context<AppEnv>, purpose: "register" | "login", challenge: string) {
  const token = randomToken();
  await c.env.DB.prepare("INSERT INTO operator_challenges (token_hash, purpose, challenge, config_hash, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(await operatorHash(token), purpose, challenge, await configurationHash(c.env), Date.now() + CHALLENGE_MINUTES * 60_000).run();
  c.header("Set-Cookie", cookie(c.req.raw, token, CHALLENGE_MINUTES * 60, challengeCookieName(c.req.raw)));
}
/** El desafío de esta cookie, consumido: sirve una sola vez. */
async function takeChallenge(c: Context<AppEnv>, purpose: "register" | "login"): Promise<string | null> {
  const token = readCookie(c.req.raw, challengeCookieName(c.req.raw));
  if (!token) return null;
  const row = await c.env.DB.prepare("DELETE FROM operator_challenges WHERE token_hash = ? AND purpose = ? AND config_hash = ? AND expires_at > ? RETURNING challenge")
    .bind(await operatorHash(token), purpose, await configurationHash(c.env), Date.now()).first<{ challenge: string }>();
  return row?.challenge ?? null;
}
const clearChallenge = (request: Request) => cookie(request, "", 0, challengeCookieName(request));
interface OperatorPasskey { credential_id: string; public_key: string; counter: number; transports: string | null }
async function passkeys(env: AppEnv["Bindings"]) {
  const config = await configurationHash(env);
  const owner = await passkeyOwnerHash(env);
  return (await env.DB.prepare("SELECT credential_id, public_key, counter, transports, name, created_at, last_used_at FROM operator_passkeys WHERE config_hash = ? OR config_hash = ? ORDER BY created_at")
    .bind(owner, config).all<OperatorPasskey & { name: string | null; created_at: number; last_used_at: number | null }>()).results;
}
const transportsOf = (value: string | null) => (value ? value.split(",") : undefined) as AuthenticatorTransportFuture[] | undefined;
function isCredential(value: unknown): value is { id: string } {
  return Boolean(value) && typeof value === "object" && typeof (value as { id?: unknown }).id === "string";
}

export const operatorAuth = new Hono<AppEnv>();
// Las respuestas de WebAuthn pesan más que la clave y el código.
operatorAuth.use("*", (c, next) => bodyLimit({ maxSize: c.req.path.includes("/passkey") ? 8192 : 2048, onError: (c) => c.json({ error: "too-large" }, 413) })(c, next));
operatorAuth.use("*", async (c, next) => {
  if (!operatorConfigured(c.env)) return c.json({ error: "not-configured" }, 404);
  if (!operatorRequestAllowed(c.req.raw, c.env)) return c.json({ error: "forbidden-origin" }, 403);
  return next();
});
operatorAuth.post("/login", async (c) => {
  const input: unknown = await c.req.json().catch(() => null);
  if (!input || typeof input !== "object" || !("key" in input) || !("code" in input) ||
    typeof input.key !== "string" || !/^[a-f0-9]{64}$/.test(input.key) || typeof input.code !== "string" || !/^\d{6}$/.test(input.code)) return c.json({ error: "invalid-credentials" }, 401);
  if (await ipLimited(c)) return c.json({ error: "rate-limited" }, 429);
  if (!equal(await operatorHash(input.key), c.env.OPERATOR_KEY_HASH!)) return c.json({ error: "invalid-credentials" }, 401);
  // Solo alguien con la clave correcta puede consumir el cupo global del segundo factor.
  if (await limited(c.env, "operator:totp", 10)) return c.json({ error: "rate-limited" }, 429);
  if (!(await consumeTotp(c.env, input.code))) return c.json({ error: "invalid-credentials" }, 401);
  return startSession(c);
});
operatorAuth.get("/session", async (c) => {
  const email = await operatorSession(c.req.raw, c.env);
  return email ? c.json({ email }) : c.json({ error: "unauthorized" }, 401);
});
operatorAuth.post("/logout", async (c) => {
  const token = sessionToken(c.req.raw);
  if (token) await c.env.DB.prepare("DELETE FROM operator_sessions WHERE token_hash = ?").bind(await operatorHash(token)).run();
  c.header("Set-Cookie", cookie(c.req.raw, "", 0));
  return c.json({ ok: true });
});

/** Entrar con una llave: el navegador elige la del dispositivo (huella, cara o PIN obligatorios). */
operatorAuth.post("/passkey/login/options", async (c) => {
  if (await ipLimited(c)) return c.json({ error: "rate-limited" }, 429);
  const options = await generateAuthenticationOptions({ rpID: rpID(c.env), userVerification: "required", allowCredentials: [] });
  await saveChallenge(c, "login", options.challenge);
  return c.json(options);
});
operatorAuth.post("/passkey/login", async (c) => {
  const input: unknown = await c.req.json().catch(() => null);
  const response = input && typeof input === "object" && "response" in input ? input.response : null;
  if (!isCredential(response)) return c.json({ error: "invalid-credentials" }, 401);
  const expectedChallenge = await takeChallenge(c, "login");
  const owner = await passkeyOwnerHash(c.env);
  const config = await configurationHash(c.env);
  const stored = expectedChallenge && await c.env.DB.prepare("SELECT credential_id, public_key, counter, transports FROM operator_passkeys WHERE credential_id = ? AND (config_hash = ? OR config_hash = ?)")
    .bind(response.id, owner, config).first<OperatorPasskey>();
  if (!expectedChallenge || !stored) return c.json({ error: "invalid-credentials" }, 401);
  try {
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response: response as AuthenticationResponseJSON,
      expectedChallenge,
      expectedOrigin: c.env.APP_ORIGIN,
      expectedRPID: rpID(c.env),
      credential: { id: stored.credential_id, publicKey: isoBase64URL.toBuffer(stored.public_key), counter: stored.counter, transports: transportsOf(stored.transports) },
      requireUserVerification: true,
    });
    if (!verified) return c.json({ error: "invalid-credentials" }, 401);
    await c.env.DB.prepare("UPDATE operator_passkeys SET counter = ?, last_used_at = ? WHERE credential_id = ?").bind(authenticationInfo.newCounter, Date.now(), stored.credential_id).run();
  } catch {
    return c.json({ error: "invalid-credentials" }, 401);
  }
  return startSession(c, [clearChallenge(c.req.raw)], SEVEN_DAYS);
});

/** Lo que sigue pide la sesión del operador abierta. */
operatorAuth.use("/passkeys/*", async (c, next) => (await operatorSession(c.req.raw, c.env) ? next() : c.json({ error: "unauthorized" }, 401)));
operatorAuth.use("/passkeys", async (c, next) => (await operatorSession(c.req.raw, c.env) ? next() : c.json({ error: "unauthorized" }, 401)));
operatorAuth.get("/passkeys", async (c) => {
  const list = await passkeys(c.env);
  return c.json({ passkeys: list.map((entry) => ({ id: entry.credential_id, name: entry.name, createdAt: entry.created_at, lastUsedAt: entry.last_used_at })) });
});
operatorAuth.post("/passkeys/options", async (c) => {
  const existing = await passkeys(c.env);
  const options = await generateRegistrationOptions({
    rpName: "Refugiar · operador",
    rpID: rpID(c.env),
    userName: c.env.OPERATOR_EMAIL!,
    // El mismo usuario en cada llave: registrar otra vez en el mismo dispositivo la reemplaza.
    userID: isoBase64URL.toBuffer(isoBase64URL.fromUTF8String(c.env.OPERATOR_EMAIL!)),
    attestationType: "none",
    excludeCredentials: existing.map((entry) => ({ id: entry.credential_id, transports: transportsOf(entry.transports) })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  await saveChallenge(c, "register", options.challenge);
  return c.json(options);
});
/** Sumar una llave pide un código nuevo del autenticador: una sesión robada no alcanza. */
operatorAuth.post("/passkeys", async (c) => {
  const input: unknown = await c.req.json().catch(() => null);
  if (!input || typeof input !== "object") return c.json({ error: "invalid" }, 400);
  const { response, code, name } = input as { response?: unknown; code?: unknown; name?: unknown };
  if (!isCredential(response) || typeof code !== "string" || !/^\d{6}$/.test(code) || (name !== undefined && (typeof name !== "string" || name.length > 40))) return c.json({ error: "invalid" }, 400);
  if (await limited(c.env, "operator:totp", 10)) return c.json({ error: "rate-limited" }, 429);
  if (!(await consumeTotp(c.env, code))) return c.json({ error: "invalid-credentials" }, 401);
  const expectedChallenge = await takeChallenge(c, "register");
  if (!expectedChallenge) return c.json({ error: "challenge-expired" }, 400);
  try {
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: c.env.APP_ORIGIN,
      expectedRPID: rpID(c.env),
      requireUserVerification: true,
    });
    if (!verified || !registrationInfo) return c.json({ error: "invalid" }, 400);
    const { credential } = registrationInfo;
    const owner = await passkeyOwnerHash(c.env);
    await c.env.DB.prepare("INSERT INTO operator_passkeys (credential_id, config_hash, public_key, counter, transports, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(credential.id, owner, isoBase64URL.fromBuffer(credential.publicKey), credential.counter, credential.transports?.join(",") ?? null, (name as string | undefined)?.trim() || null, Date.now()).run();
  } catch {
    return c.json({ error: "invalid" }, 400);
  }
  c.header("Set-Cookie", clearChallenge(c.req.raw));
  return c.json({ ok: true }, 201);
});
operatorAuth.delete("/passkeys/:id", async (c) => {
  const owner = await passkeyOwnerHash(c.env);
  const config = await configurationHash(c.env);
  const result = await c.env.DB.prepare("DELETE FROM operator_passkeys WHERE credential_id = ? AND (config_hash = ? OR config_hash = ?)").bind(c.req.param("id"), owner, config).run();
  return result.meta.changes ? c.json({ ok: true }) : c.json({ error: "not-found" }, 404);
});
