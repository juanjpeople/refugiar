import { projectShares } from "./project-shares";
import { contentShares } from "./content-shares";
import { weatherBrief, newsBrief } from "./brief";
/**
 * Worker de Refugiar: sirve la app (archivos estáticos) y la API en el mismo origen (`/api/*`),
 * así las cookies de sesión son de primera parte: sin CORS ni cookies de terceros en producción.
 *
 * Cifrado de extremo a extremo: el servidor guarda claves y datos ya cifrados en los dispositivos.
 * Su trabajo es autenticar, autorizar (quién es miembro de qué casa, con qué rol) y ordenar.
 */
import { betterAuth } from "better-auth";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { z } from "zod";
import { opSigningData, SYNC_LIMITS } from "../../src/lib/sync/protocol";
import { authOptions } from "./auth-options";
import { enabledSocialProviders, socialProviders } from "./social-auth";
import type { AppEnv, Env, SessionUser } from "./env";
import { DAY, INACTIVITY_NOTICE_DAYS, inactivityNoticeWindow, inactiveBefore } from "./inactivity";
import { PhotoStorageError, photoStorage } from "./photo-storage";
import { operatorAuth, operatorConfigured, operatorRequestAllowed, operatorSession } from "./operator-auth";
import { operatorPage } from "./operator-page";
import { accessEmailStatement, mailConfigState, mailOverview, processEmails, queueTestEmail, securityEmailStatements } from "./mail";
import { OP_CONFLICT } from "./sync";
import { defaultQuotas, HOUSEHOLD_QUOTAS, householdQuotas, PHOTO_FREE_BYTES, QUOTA_EXCEEDED, quotaKind, quotasOn, recordQuotaHit } from "./quotas";
import { DEVICE_LINK_MINUTES } from "../../src/lib/cloud/device-protocol";
import {
  acceptInviteInput,
  changePasswordInput,
  changeRoleInput,
  createHouseholdInput,
  createInviteInput,
  createLicensesInput,
  deleteHouseholdInput,
  deleteUserInput,
  deviceLinkInput,
  envelopeInput,
  feedbackInput,
  feedbackStatusInput,
  householdQuotaInput,
  inactivityNoticeStatusInput,
  inviteTokenInput,
  licenseCheckInput,
  passkeyUnlockInput,
  pullQuery,
  pushInput,
  quotaDefaultsInput,
  recoveryCompleteInput,
  recoveryKitInput,
  recoveryStartInput,
  removeMemberInput,
  signUpAccessInput,
  userId,
  userKeysInput,
  uuid,
  waitlistEnableInput,
  waitlistInput,
  type Role,
  type Scope,
} from "./validation";

export { HouseholdLog } from "./sync";

function allowedOrigins(env: Env) {
  return [env.APP_ORIGIN, ...(env.DEV_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean)];
}

function createAuth(env: Env) {
  return betterAuth(
    authOptions(env.DB, {
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.APP_ORIGIN,
      trustedOrigins: allowedOrigins(env),
      // Nube cerrada, salvo en el servidor de casa y el laboratorio (`HOUSEHOLD_ACCESS=open`).
      signUpGate: env.HOUSEHOLD_ACCESS === "open" ? undefined : (access) => signUpAllowed(env, access),
      ...socialProviders(env),
    }),
  );
}

/** Qué niveles de privacidad puede abrir cada rol: los chicos no ven "Adultos". */
function scopesFor(role: Role): Scope[] {
  return role === "kid" ? ["family", "private"] : ["family", "adults", "private"];
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64u(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (char) => char.charCodeAt(0));
}

/** Firma Ed25519 válida (una clave o firma mal formada cuenta como inválida). */
async function verifySignature(publicKey: string, data: string, signature: string) {
  try {
    const key = await crypto.subtle.importKey("raw", fromB64u(publicKey), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, fromB64u(signature), new TextEncoder().encode(data));
  } catch {
    return false;
  }
}

/** "od-abcd efgh…" → "ODABCDEFGH…": el código se compara sin guiones ni espacios, en mayúscula. */
function normalizeLicenseCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Comparación en tiempo constante (no corta en el primer carácter distinto). */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

const app = new Hono<AppEnv>().basePath("/api");

// Encabezados de seguridad en toda respuesta de la API.
app.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
});

// CORS solo para los orígenes de desarrollo (en producción la app y la API comparten origen).
app.use("*", async (c, next) => {
  const dev = (c.env.DEV_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (dev.length === 0) return next();
  return cors({ origin: dev, credentials: true, allowHeaders: ["Content-Type", "X-Refugiar-External"], allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] })(c, next);
});

export const PULSE_METRICS = [
  "landing",
  "demo_open",
  "pwa_boot",
  "android_boot",
  "waitlist_submit",
  "module:dashboard",
  "module:recipes",
  "module:inventory",
  "module:shopping",
  "module:projects",
  "module:calendar",
  "module:pets",
  "module:family",
] as const;
export type PulseMetric = (typeof PULSE_METRICS)[number];

// CSRF: todo lo que cambia algo tiene que venir de la app (Origin conocido). Better Auth valida lo suyo.
app.use("*", async (c, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method) || c.req.path.startsWith("/api/auth/") || c.req.path.startsWith("/api/admin/") || c.req.path === "/api/pulse") return next();
  const origin = c.req.header("Origin");
  if (!origin || !allowedOrigins(c.env).includes(origin)) return c.json({ error: "forbidden-origin" }, 403);
  return next();
});

app.use("/pulse", bodyLimit({ maxSize: 512, onError: (c) => c.json({ error: "too-large" }, 413) }));
app.use("/auth/*", bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: "too-large" }, 413) }));
app.use("/feedback", bodyLimit({ maxSize: 8 * 1024, onError: (c) => c.json({ error: "too-large" }, 413) }));
app.use("/waitlist", bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json({ error: "too-large" }, 413) }));
/**
 * Sumar una llave de acceso pide la contraseña: con una sesión robada no se puede agregar una
 * llave propia y saltear después el segundo paso. El resto lo valida Better Auth.
 */
app.post("/auth/passkey/verify-registration", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.raw.clone().json().catch(() => null)) as { password?: unknown } | null;
  if (typeof body?.password !== "string") return c.json({ error: "wrong-password" }, 403);
  if (await tooMany(c.env, `password:${user.id}`, 5, RECOVERY_WINDOW)) return c.json({ error: "rate-limited" }, 429);
  if (!(await checkPassword(c.env, user.id, body.password))) return c.json({ error: "wrong-password" }, 403);
  return createAuth(c.env).handler(c.req.raw);
});
app.on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

/** Nube cerrada (ver closed-sign-up.ts): una licencia vigente o una invitación para una cuenta, sin usar. */
async function signUpAllowed(env: Env, raw: unknown) {
  const access = signUpAccessInput.safeParse(raw);
  if (!access.success) return false;
  if ("code" in access.data) return licenseAvailable(env, access.data.code);
  const found = await findInvite(env, access.data.invite.id, access.data.invite.authToken);
  return !("error" in found) && found.invite.kind === "account";
}

/** ¿La licencia sirve todavía? (Vigente, sin vencer y con usos.) No la consume. */
async function licenseAvailable(env: Env, code: string) {
  const license = await env.DB.prepare(
    "select 1 from cloud_licenses where code_hash = ? and status = 'active' and used < max_households and (expires_at is null or expires_at > ?)",
  )
    .bind(await sha256(normalizeLicenseCode(code)), Date.now())
    .first();
  return Boolean(license);
}

app.get("/health", (c) => c.json({ ok: true }));


// Only explicit, individually permitted requests reach the optional public sources.
app.get("/brief/:kind/:id", async (c) => {
  if (c.req.header("X-Refugiar-External") !== "granted") return c.json({ error: "permission-required" }, 403);
  try {
    const value = c.req.param("kind") === "weather" ? await weatherBrief(c.req.param("id"))
      : c.req.param("kind") === "news" ? await newsBrief(c.req.param("id")) : null;
    return value ? c.json(value) : c.json({ error: "not-found" }, 404);
  } catch { return c.json({ error: "provider-unavailable" }, 503); }
});


app.get("/social-providers", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ providers: enabledSocialProviders(c.env) });
});

/** Exige sesión. */
async function requireUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return null;
  const user = { id: session.user.id, name: session.user.name, email: session.user.email, twoFactorEnabled: Boolean((session.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled) };
  c.set("user", user);
  c.set("sessionId", session.session.id);
  return user;
}

/**
 * Límite de intentos (ventana fija) para lo que no pasa por Better Auth. En la base: cada isolate
 * del Worker tiene su propia memoria. Devuelve `true` si ya se pasó del máximo.
 */
async function tooMany(env: Env, key: string, max: number, windowMs: number) {
  const now = Date.now();
  const row = await env.DB.prepare(
    `insert into attempts (key, count, window_start) values (?, 1, ?)
       on conflict (key) do update set
         count = case when attempts.window_start < ? then 1 else attempts.count + 1 end,
         window_start = case when attempts.window_start < ? then excluded.window_start else attempts.window_start end
     returning count`,
  )
    .bind(key, now, now - windowMs, now - windowMs)
    .first<{ count: number }>();
  return (row?.count ?? 0) > max;
}

const clientIp = (c: Context<AppEnv>) => c.req.header("cf-connecting-ip") ?? "local";

/** ¿Es la contraseña (la clave derivada) de esta persona? Con el mismo hash que usa Better Auth. */
async function checkPassword(env: Env, userId: string, password: string) {
  const account = await env.DB.prepare(`select "password" from "account" where "userId" = ? and "providerId" = 'credential'`).bind(userId).first<{ password: string | null }>();
  if (!account?.password) return false;
  return (await createAuth(env).$context).password.verify({ hash: account.password, password });
}

/** Cambia la contraseña: la sentencia va en el mismo lote (transacción) que el cambio de claves. */
async function setPasswordStatement(env: Env, userId: string, password: string) {
  const hash = await (await createAuth(env).$context).password.hash(password);
  return env.DB.prepare(`update "account" set "password" = ?, "updatedAt" = ? where "userId" = ? and "providerId" = 'credential'`).bind(hash, new Date().toISOString(), userId);
}

async function parse<T extends z.ZodTypeAny>(c: Context<AppEnv>, schema: T): Promise<z.infer<T> | null> {
  const result = schema.safeParse(await c.req.json().catch(() => null));
  return result.success ? result.data : null;
}

async function membership(env: Env, householdId: string, userId: string) {
  return env.DB.prepare("select role from memberships where household_id = ? and user_id = ?").bind(householdId, userId).first<{ role: Role }>();
}

async function touchHousehold(env: Env, householdId: string, now = Date.now()) {
  await env.DB.batch([
    env.DB.prepare("update households set last_activity_at = ? where id = ? and coalesce(last_activity_at, 0) < ?").bind(now, householdId, now - DAY),
    env.DB.prepare("update inactivity_notices set status = 'cancelled', updated_at = ? where household_id = ? and status = 'pending'").bind(now, householdId),
  ]);
}

async function processInactivity(env: Env, now = Date.now()) {
  const statements = INACTIVITY_NOTICE_DAYS.map((daysBeforePause, index) => {
    const window = inactivityNoticeWindow(daysBeforePause, index, now);
    return env.DB
      .prepare(
      `insert into inactivity_notices (household_id, days_before_pause, due_at, status, created_at, updated_at)
       select h.id, ?, coalesce(h.last_activity_at, h.created_at) + ?, 'pending', ?, ?
         from households h join household_plans p on p.household_id = h.id
        where p.status = 'active'
          and coalesce(h.last_activity_at, h.created_at) <= ?
          and coalesce(h.last_activity_at, h.created_at) > ?
       on conflict (household_id, days_before_pause) do nothing`,
      )
      .bind(
        daysBeforePause,
        window.dueAtOffset,
        now,
        now,
        window.activeBefore,
        window.activeAfter,
      );
  });
  const results = await env.DB.batch([
    ...statements,
    env.DB.prepare(
      `update household_plans
          set status = 'paused', updated_at = ?
        where status = 'active'
          and household_id in (
            select id from households where coalesce(last_activity_at, created_at) <= ?
          )`,
    ).bind(now, inactiveBefore(now)),
  ]);
  return {
    noticesQueued: results.slice(0, INACTIVITY_NOTICE_DAYS.length).reduce((total, result) => total + result.meta.changes, 0),
    householdsPaused: results[results.length - 1].meta.changes,
  };
}

// --- Mis claves ------------------------------------------------------------------------

app.post("/keys", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const input = await parse(c, userKeysInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const now = Date.now();
  // Una sola vez: cambiar las claves (contraseña nueva, recuperación) es otro flujo, con su propia prueba.
  const result = await c.env.DB.prepare(
    "insert into user_keys (user_id, kdf_version, enc_public_key, sign_public_key, private_keys, recovery_private_keys, recovery_verifier, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict (user_id) do nothing",
  )
    .bind(user.id, input.kdfVersion, input.encPublicKey, input.signPublicKey, input.privateKeys, input.recoveryPrivateKeys, input.recoveryVerifier, now, now)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "keys-exist" }, 409);
  return c.json({ ok: true }, 201);
});

app.get("/me", async (c) => {
  const user = await requireUser(c);
  // "¿Hay sesión?" es una pregunta normal al abrir la app, no un error: sin sesión, `user: null`.
  if (!user) return c.json({ user: null });
  const keys = await c.env.DB.prepare(
    "select kdf_version as kdfVersion, enc_public_key as encPublicKey, sign_public_key as signPublicKey, private_keys as privateKeys from user_keys where user_id = ?",
  )
    .bind(user.id)
    .first();
  const households = await c.env.DB.prepare(
    `select h.id, h.encrypted_name as encryptedName, h.family_key_version as familyKeyVersion, h.adults_key_version as adultsKeyVersion, m.role,
            coalesce(h.last_activity_at, h.created_at) as lastActivityAt,
            coalesce(p.plan, 'beta') as plan, coalesce(p.status, 'active') as planStatus
       from memberships m join households h on h.id = m.household_id left join household_plans p on p.household_id = h.id
      where m.user_id = ? order by m.joined_at`,
  )
    .bind(user.id)
    .all<{ id: string; encryptedName: string; familyKeyVersion: number; adultsKeyVersion: number; role: Role; lastActivityAt: number; plan: string; planStatus: "active" | "paused" }>();
  const envelopes = await c.env.DB.prepare(
    "select household_id as householdId, scope, version, envelope from key_envelopes where recipient_user_id = ?",
  )
    .bind(user.id)
    .all<{ householdId: string; scope: Scope; version: number; envelope: string }>();
  await Promise.all(households.results.map((household) => touchHousehold(c.env, household.id)));
  return c.json({
    user: { ...user, device: await isDevice(c.env, user.id) },
    keys,
    households: households.results.map((household) => ({
      ...household,
      envelopes: envelopes.results.filter((entry) => entry.householdId === household.id).map(({ scope, version, envelope }) => ({ scope, version, envelope })),
    })),
  });
});

// --- Recuperar con el kit (sin sesión y sin email) -----------------------------------------

const RECOVERY_WINDOW = 15 * 60_000;

/**
 * La cuenta, si la prueba del kit es la correcta. La comparación se hace siempre (también si el
 * email no tiene cuenta) y la respuesta es la misma: no se puede averiguar qué emails existen.
 */
async function findRecovery(env: Env, email: string, recoveryAuth: string) {
  const row = await env.DB.prepare(
    `select u.id as userId, k.kdf_version as kdfVersion, k.enc_public_key as encPublicKey, k.sign_public_key as signPublicKey,
            k.recovery_private_keys as recoveryPrivateKeys, k.recovery_verifier as verifier
       from "user" u join user_keys k on k.user_id = u.id where u.email = ?`,
  )
    .bind(email)
    .first<{ userId: string; kdfVersion: number; encPublicKey: string; signPublicKey: string; recoveryPrivateKeys: string; verifier: string | null }>();
  const matches = timingSafeEqual(row?.verifier ?? "-".repeat(43), await sha256(recoveryAuth));
  return row?.verifier && matches ? row : null;
}

async function recoveryLimited(c: Context<AppEnv>, email: string) {
  return (await tooMany(c.env, `recovery:ip:${clientIp(c)}`, 20, RECOVERY_WINDOW)) || (await tooMany(c.env, `recovery:email:${email}`, 5, RECOVERY_WINDOW));
}

/** Paso 1: con email + prueba del kit, la copia de las claves cifrada con el kit (se abre en el dispositivo). */
app.post("/recovery/start", async (c) => {
  const input = await parse(c, recoveryStartInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await recoveryLimited(c, input.email)) return c.json({ error: "rate-limited" }, 429);
  const found = await findRecovery(c.env, input.email, input.recoveryAuth);
  if (!found) return c.json({ error: "recovery-failed" }, 403);
  return c.json({ kdfVersion: found.kdfVersion, encPublicKey: found.encPublicKey, signPublicKey: found.signPublicKey, recoveryPrivateKeys: found.recoveryPrivateKeys });
});

/**
 * Paso 2: contraseña nueva, claves re-cifradas con ella y un kit nuevo (el usado deja de servir),
 * todo junto. Se cierran todas las sesiones: quien tuviera la contraseña vieja queda afuera.
 */
app.post("/recovery/complete", async (c) => {
  const input = await parse(c, recoveryCompleteInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await recoveryLimited(c, input.email)) return c.json({ error: "rate-limited" }, 429);
  const found = await findRecovery(c.env, input.email, input.recoveryAuth);
  if (!found) return c.json({ error: "recovery-failed" }, 403);
  await c.env.DB.batch([
    await setPasswordStatement(c.env, found.userId, input.newPassword),
    c.env.DB.prepare("update user_keys set private_keys = ?, recovery_private_keys = ?, recovery_verifier = ?, updated_at = ? where user_id = ?").bind(
      input.privateKeys,
      input.recoveryPrivateKeys,
      input.recoveryVerifier,
      Date.now(),
      found.userId,
    ),
    c.env.DB.prepare(`delete from "session" where "userId" = ?`).bind(found.userId),
    ...securityEmailStatements(c.env, { id: found.userId, email: input.email }, "recovery"),
  ]);
  return c.json({ ok: true });
});

// --- Mi cuenta: contraseña, kit y dispositivos ---------------------------------------------

/** Cambiar la contraseña sabiendo la actual. Las otras sesiones se cierran; esta sigue. */
app.post("/account/password", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const input = await parse(c, changePasswordInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await tooMany(c.env, `password:${user.id}`, 5, RECOVERY_WINDOW)) return c.json({ error: "rate-limited" }, 429);
  if (!(await checkPassword(c.env, user.id, input.currentPassword))) return c.json({ error: "wrong-password" }, 403);
  await c.env.DB.batch([
    await setPasswordStatement(c.env, user.id, input.newPassword),
    c.env.DB.prepare("update user_keys set private_keys = ?, updated_at = ? where user_id = ?").bind(input.privateKeys, Date.now(), user.id),
    c.env.DB.prepare(`delete from "session" where "userId" = ? and "id" <> ?`).bind(user.id, c.var.sessionId),
    ...securityEmailStatements(c.env, user, "password"),
  ]);
  return c.json({ ok: true });
});

/** Un kit nuevo (si el anterior se perdió o se vio): el anterior deja de servir. Pide la contraseña. */
app.post("/account/recovery-kit", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const input = await parse(c, recoveryKitInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await tooMany(c.env, `password:${user.id}`, 5, RECOVERY_WINDOW)) return c.json({ error: "rate-limited" }, 429);
  if (!(await checkPassword(c.env, user.id, input.password))) return c.json({ error: "wrong-password" }, 403);
  await c.env.DB.batch([
    c.env.DB.prepare("update user_keys set recovery_private_keys = ?, recovery_verifier = ?, updated_at = ? where user_id = ?")
      .bind(input.recoveryPrivateKeys, input.recoveryVerifier, Date.now(), user.id),
    ...securityEmailStatements(c.env, user, "kit"),
  ]);
  return c.json({ ok: true });
});

/** Dónde está abierta la cuenta (sin los tokens: no salen nunca). */
app.get("/account/devices", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const sessions = await c.env.DB.prepare(
    `select "id", "userAgent", "createdAt", "updatedAt" from "session" where "userId" = ? and "expiresAt" > ? order by "updatedAt" desc`,
  )
    .bind(user.id, new Date().toISOString())
    .all<{ id: string; userAgent: string | null; createdAt: string; updatedAt: string }>();
  return c.json({
    devices: sessions.results.map((session) => ({
      id: session.id,
      userAgent: session.userAgent ?? "",
      createdAt: Date.parse(session.createdAt),
      lastActiveAt: Date.parse(session.updatedAt),
      current: session.id === c.var.sessionId,
    })),
  });
});

/** Las llaves de acceso de la cuenta, y si cada una entra sin contraseña (tiene su copia de las claves). */
app.get("/account/passkeys", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const passkeys = await c.env.DB.prepare(
    `select p."id", p."name", p."createdAt", p."credentialID" as credentialId, u."id" is not null as unlocks
       from "passkey" p left join "passkeyUnlock" u on u."passkeyId" = p."id"
      where p."userId" = ? order by p."createdAt"`,
  )
    .bind(user.id)
    .all<{ id: string; name: string | null; createdAt: string; credentialId: string; unlocks: number }>();
  return c.json({ passkeys: passkeys.results.map((entry) => ({ ...entry, createdAt: Date.parse(entry.createdAt), unlocks: Boolean(entry.unlocks) })) });
});

/**
 * Una llave recién sumada que puede abrir los datos (PRF): guarda su copia de las claves privadas,
 * cifrada en el dispositivo. Pide la contraseña, como sumar la llave.
 */
app.post("/account/passkeys/:id/unlock", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const input = await parse(c, passkeyUnlockInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await tooMany(c.env, `password:${user.id}`, 5, RECOVERY_WINDOW)) return c.json({ error: "rate-limited" }, 429);
  if (!(await checkPassword(c.env, user.id, input.password))) return c.json({ error: "wrong-password" }, 403);
  const result = await c.env.DB.prepare(
    `insert into "passkeyUnlock" ("id", "passkeyId", "userId", "privateKeys", "createdAt")
     select ?, p."id", p."userId", ?, ? from "passkey" p where p."id" = ? and p."userId" = ?
     on conflict ("passkeyId") do nothing`,
  )
    .bind(crypto.randomUUID(), input.privateKeys, new Date().toISOString(), c.req.param("id"), user.id)
    .run();
  if (!result.meta.changes) return c.json({ error: "not-found" }, 404);
  return c.json({ ok: true }, 201);
});

/** Después de entrar con una llave: su copia de las claves (solo se abre en el dispositivo, con la llave). */
app.get("/account/passkeys/unlock/:credentialId", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const row = await c.env.DB.prepare(
    `select u."privateKeys" as privateKeys from "passkeyUnlock" u join "passkey" p on p."id" = u."passkeyId"
      where p."credentialID" = ? and p."userId" = ?`,
  )
    .bind(c.req.param("credentialId"), user.id)
    .first<{ privateKeys: string }>();
  if (!row) return c.json({ error: "not-found" }, 404);
  return c.json(row);
});

/** Cerrar la sesión de un dispositivo (deja de sincronizar; su copia local queda como estaba). */
app.delete("/account/devices/:id", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  await c.env.DB.prepare(`delete from "session" where "id" = ? and "userId" = ?`).bind(c.req.param("id"), user.id).run();
  return c.json({ ok: true });
});

/**
 * Borrar mi cuenta (lo exige Google Play y es un derecho de cada persona). Se confirma escribiendo
 * el email. Las casas donde vive sola se borran enteras: historial cifrado, fotos y registro. De
 * una casa compartida sale, y lo que escribió queda para la familia. Si es la única que administra
 * una casa con más gente, primero tiene que pasarle la administración a alguien.
 *
 * Si nunca compartió una casa, la cuenta se borra entera. Si la compartió, se borra todo lo que la
 * identifica o la deja entrar (email, nombre, contraseña, sesiones, llaves, claves privadas) y
 * quedan su id y su clave pública de firma: sin ellas, la familia no podría verificar sus cambios
 * viejos. Sale sin rotar las claves de la casa (eso lo hace quien saca a alguien): sin cuenta ya no
 * puede pedirle nada al servidor.
 */
app.post("/account/delete", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const input = await parse(c, deleteUserInput);
  if (!input || input.confirm !== user.email.toLowerCase()) return c.json({ error: "confirmation-required" }, 400);
  if (await tooMany(c.env, `delete-account:${user.id}`, 5, RECOVERY_WINDOW)) return c.json({ error: "rate-limited" }, 429);

  const homes = await c.env.DB.prepare(
    `select m.household_id as householdId, m.role,
            (select count(*) from memberships x where x.household_id = m.household_id) as members,
            (select count(*) from memberships x where x.household_id = m.household_id and x.role = 'admin') as admins
       from memberships m where m.user_id = ?`,
  )
    .bind(user.id)
    .all<{ householdId: string; role: Role; members: number; admins: number }>();
  const lastAdmin = homes.results.filter((home) => home.members > 1 && home.role === "admin" && home.admins <= 1);
  if (lastAdmin.length) return c.json({ error: "last-admin", households: lastAdmin.map((home) => home.householdId) }, 409);
  const alone = homes.results.filter((home) => home.members <= 1).map((home) => home.householdId);
  const shared = homes.results.filter((home) => home.members > 1);

  try {
    for (const householdId of alone) {
      await photoStorage(c.env).deletePrefix(`households/${householdId}/photos`);
      await householdLog(c.env, householdId).purge();
    }
  } catch (error) {
    return photoStorageFailure(c, error);
  }

  const now = Date.now();
  await c.env.DB.batch([
    ...alone.map((householdId) => c.env.DB.prepare("delete from households where id = ?").bind(householdId)),
    ...shared.flatMap((home) => [
      c.env.DB.prepare("delete from memberships where household_id = ? and user_id = ?").bind(home.householdId, user.id),
      c.env.DB.prepare("delete from key_envelopes where household_id = ? and recipient_user_id = ?").bind(home.householdId, user.id),
      c.env.DB.prepare(
        "insert into former_members (household_id, user_id, role, removed_at, removed_by) values (?, ?, ?, ?, ?) on conflict do update set role = excluded.role, removed_at = excluded.removed_at, removed_by = excluded.removed_by",
      ).bind(home.householdId, user.id, home.role, now, user.id),
    ]),
    // Sus invitaciones sin usar y sus pedidos para entrar a otras casas ya no tienen sentido.
    c.env.DB.prepare("delete from invites where created_by = ? and used_at is null").bind(user.id),
    c.env.DB.prepare("delete from join_requests where user_id = ?").bind(user.id),
    c.env.DB.prepare("delete from email_outbox where user_id = ? and status in ('pending', 'failed')").bind(user.id),
    c.env.DB.prepare("update feedback set email = null, user_id = null where user_id = ?").bind(user.id),
  ]);

  // Sin rastro en ninguna casa: se borra la fila y todo lo suyo en cascada.
  const removed = await c.env.DB.prepare(`delete from "user" where id = ? and not ${inHouseholds(`"user".id`)}`).bind(user.id).run();
  if (!removed.meta.changes) {
    await c.env.DB.batch([
      c.env.DB.prepare(`update "user" set "name" = '', "email" = ?, "emailVerified" = 0, "image" = null, "twoFactorEnabled" = 0, "updatedAt" = ? where "id" = ?`)
        .bind(`deleted-${user.id}@deleted.invalid`, new Date(now).toISOString(), user.id),
      c.env.DB.prepare(`delete from "session" where "userId" = ?`).bind(user.id),
      c.env.DB.prepare(`delete from "account" where "userId" = ?`).bind(user.id),
      c.env.DB.prepare(`delete from "passkey" where "userId" = ?`).bind(user.id),
      c.env.DB.prepare(`delete from "twoFactor" where "userId" = ?`).bind(user.id),
      c.env.DB.prepare(`delete from "verification" where "value" = ?`).bind(user.id),
      c.env.DB.prepare("delete from platform_admin_grants where user_id = ?").bind(user.id),
      c.env.DB.prepare("update user_keys set private_keys = '', recovery_private_keys = '', recovery_verifier = null, updated_at = ? where user_id = ?").bind(now, user.id),
    ]);
  }
  return c.json({ ok: true });
});

// --- Casas -------------------------------------------------------------------------------

app.post("/households", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const input = await parse(c, createHouseholdInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const hasKeys = await c.env.DB.prepare("select 1 from user_keys where user_id = ?").bind(user.id).first();
  if (!hasKeys) return c.json({ error: "no-keys" }, 409);
  const scopes = new Set(input.envelopes.map((entry) => entry.scope));
  if (!scopes.has("family") || !scopes.has("adults") || input.envelopes.some((entry) => entry.version !== 1)) return c.json({ error: "invalid-envelopes" }, 400);

  const now = Date.now();
  const open = c.env.HOUSEHOLD_ACCESS === "open";
  if (!open) {
    if (await tooMany(c.env, `license:${user.id}`, 10, RECOVERY_WINDOW)) return c.json({ error: "rate-limited" }, 429);
    if (!input.accessCode) return c.json({ error: "license-required" }, 403);
  }
  const codeHash = input.accessCode ? await sha256(normalizeLicenseCode(input.accessCode)) : "";
  // batch = una transacción en D1: o se crea todo, o nada. Con licencia, primero se consume (si
  // es válida, está activa, no venció y le quedan usos) y la casa se crea solo si se consumió.
  const results = await c.env.DB.batch([
    open
      ? c.env.DB.prepare("select 1")
      : c.env.DB.prepare(
          "update cloud_licenses set used = used + 1 where code_hash = ? and status = 'active' and used < max_households and (expires_at is null or expires_at > ?)",
        ).bind(codeHash, now),
    c.env.DB.prepare(`insert into households (id, encrypted_name, created_by, created_at) select ?, ?, ?, ? where ${open ? "1" : "changes() = 1"}`).bind(
      input.id,
      input.encryptedName,
      user.id,
      now,
    ),
    c.env.DB.prepare("insert into memberships (household_id, user_id, role, joined_at) select ?, ?, 'admin', ? where exists (select 1 from households where id = ?)").bind(
      input.id,
      user.id,
      now,
      input.id,
    ),
    ...input.envelopes.map((entry) =>
      c.env.DB.prepare(
        "insert into key_envelopes (household_id, scope, version, recipient_user_id, envelope, created_by, created_at) select ?, ?, ?, ?, ?, ?, ? where exists (select 1 from households where id = ?)",
      ).bind(input.id, entry.scope, entry.version, user.id, entry.envelope, user.id, now, input.id),
    ),
    // Quien venía de la lista de espera ya tiene su casa: su email no se guarda más.
    c.env.DB.prepare("delete from cloud_waitlist where license_id in (select id from cloud_licenses where code_hash = ?) and exists (select 1 from households where id = ?)").bind(codeHash, input.id),
    c.env.DB.prepare(
      `insert into household_plans (household_id, license_id, plan, status, updated_at)
         select ?, l.id, coalesce(l.plan, 'beta'), 'active', ?
           from (select 1) left join cloud_licenses l on l.code_hash = ?
          where exists (select 1 from households where id = ?)`,
    ).bind(input.id, now, codeHash, input.id),
  ]);
  if (results[1].meta.changes === 0) return c.json({ error: "license-invalid" }, 403);
  return c.json({ id: input.id }, 201);
});

/** Antes de crear la cuenta: ¿el código de licencia sirve? (No lo consume.) */
app.post("/licenses/check", async (c) => {
  const input = await parse(c, licenseCheckInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await tooMany(c.env, `license-check:${clientIp(c)}`, 20, RECOVERY_WINDOW)) return c.json({ error: "rate-limited" }, 429);
  if (c.env.HOUSEHOLD_ACCESS === "open") return c.json({ valid: true });
  return c.json({ valid: await licenseAvailable(c.env, input.code) });
});

app.get("/households/:id/members", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if (!(await membership(c.env, householdId, user.id))) return c.json({ error: "not-found" }, 404);
  const members = await c.env.DB.prepare(
    `select m.user_id as userId, u.name, m.role, m.joined_at as joinedAt, k.enc_public_key as encPublicKey, k.sign_public_key as signPublicKey,
            exists (select 1 from "deviceKey" d where d."userId" = m.user_id) as device
       from memberships m join "user" u on u.id = m.user_id left join user_keys k on k.user_id = m.user_id
      where m.household_id = ? order by m.joined_at`,
  )
    .bind(householdId)
    .all();
  // Quienes se fueron: solo su rol de entonces y su clave de firma, para verificar sus cambios viejos.
  const former = await c.env.DB.prepare(
    `select f.user_id as userId, u.name, f.role, f.removed_at as removedAt, k.sign_public_key as signPublicKey
       from former_members f join "user" u on u.id = f.user_id left join user_keys k on k.user_id = f.user_id
      where f.household_id = ? order by f.removed_at`,
  )
    .bind(householdId)
    .all();
  return c.json({ members: members.results, former: former.results });
});

/**
 * Sacar a alguien de la casa. Quien lo saca manda claves NUEVAS de los niveles que esa persona
 * tenía (Familia siempre; Adultos si no era chico), ensobradas para cada uno de los que quedan, y
 * el nombre de la casa cifrado con la Familia nueva. Desde acá, lo nuevo se cifra con claves que
 * esa persona no tiene. Las invitaciones pendientes se anulan (llevaban las claves viejas).
 */
app.post("/households/:id/members/:userId/remove", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  const targetId = c.req.param("userId");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  if (targetId === user.id) return c.json({ error: "self" }, 400);
  const target = await membership(c.env, householdId, targetId);
  if (!target) return c.json({ error: "not-found" }, 404);
  const input = await parse(c, removeMemberInput);
  if (!input) return c.json({ error: "invalid" }, 400);

  const household = await c.env.DB.prepare("select family_key_version as family, adults_key_version as adults from households where id = ?")
    .bind(householdId)
    .first<{ family: number; adults: number }>();
  const remaining = await c.env.DB.prepare("select user_id as userId, role from memberships where household_id = ? and user_id <> ?")
    .bind(householdId, targetId)
    .all<{ userId: string; role: Role }>();
  if (!household) return c.json({ error: "not-found" }, 404);

  // Cada nivel que tenía se rota a la versión siguiente, con un sobre para cada uno de los que lo pueden abrir.
  const needed: ("family" | "adults")[] = target.role === "kid" ? ["family"] : ["family", "adults"];
  const byScope = new Map(input.rotation.map((entry) => [entry.scope, entry]));
  if (byScope.size !== input.rotation.length || needed.some((scope) => !byScope.has(scope)) || input.rotation.some((entry) => !needed.includes(entry.scope))) {
    return c.json({ error: "invalid-rotation" }, 400);
  }
  for (const scope of needed) {
    const entry = byScope.get(scope)!;
    const expected = remaining.results.filter((member) => scopesFor(member.role).includes(scope)).map((member) => member.userId);
    const given = entry.envelopes.map((envelope) => envelope.userId);
    if (entry.version !== household[scope] + 1) return c.json({ error: "stale-key" }, 409);
    // Alguien entró o cambió de rol mientras tanto: hay que volver a armar los sobres.
    if (new Set(given).size !== given.length || given.length !== expected.length || !expected.every((id) => given.includes(id))) {
      return c.json({ error: "members-changed" }, 409);
    }
  }

  const now = Date.now();
  const family = byScope.get("family")!;
  const adults = byScope.get("adults");
  await c.env.DB.batch([
    c.env.DB.prepare("delete from memberships where household_id = ? and user_id = ?").bind(householdId, targetId),
    c.env.DB.prepare("delete from key_envelopes where household_id = ? and recipient_user_id = ?").bind(householdId, targetId),
    c.env.DB.prepare(
      "insert into former_members (household_id, user_id, role, removed_at, removed_by) values (?, ?, ?, ?, ?) on conflict do update set role = excluded.role, removed_at = excluded.removed_at, removed_by = excluded.removed_by",
    ).bind(householdId, targetId, target.role, now, user.id),
    ...input.rotation.flatMap((entry) =>
      entry.envelopes.map((envelope) =>
        c.env.DB.prepare(
          "insert into key_envelopes (household_id, scope, version, recipient_user_id, envelope, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?)",
        ).bind(householdId, entry.scope, entry.version, envelope.userId, envelope.envelope, user.id, now),
      ),
    ),
    c.env.DB.prepare("update households set encrypted_name = ?, family_key_version = ?, adults_key_version = ? where id = ?").bind(
      input.encryptedName,
      family.version,
      adults?.version ?? household.adults,
      householdId,
    ),
    c.env.DB.prepare("delete from invites where household_id = ? and used_at is null").bind(householdId),
    // El celular de un chico vive para esta casa: sin ella, su llave y sus sesiones no sirven más.
    c.env.DB.prepare(`delete from "session" where "userId" = ? and exists (select 1 from "deviceKey" where "userId" = ?)`).bind(targetId, targetId),
    c.env.DB.prepare(`delete from "deviceKey" where "userId" = ?`).bind(targetId),
  ]);
  return c.json({ ok: true });
});

app.patch("/households/:id/members/:userId", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  const input = await parse(c, changeRoleInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const target = await membership(c.env, householdId, c.req.param("userId"));
  if (!target) return c.json({ error: "not-found" }, 404);
  if (await isDevice(c.env, c.req.param("userId"))) return c.json({ error: "device-account" }, 409);
  if (target.role === "admin" && input.role !== "admin") {
    const admins = await c.env.DB.prepare("select count(*) as count from memberships where household_id = ? and role = 'admin'").bind(householdId).first<{ count: number }>();
    if ((admins?.count ?? 0) <= 1) return c.json({ error: "last-admin" }, 409);
  }
  const targetId = c.req.param("userId");
  const setRole = c.env.DB.prepare("update memberships set role = ? where household_id = ? and user_id = ?").bind(input.role, householdId, targetId);
  if (input.role !== "kid" || target.role === "kid") {
    await setRole.run();
    return c.json({ ok: true });
  }

  // Pasar a chico: deja de ver "Adultos", y como ya tenía esa clave, se rota (igual que al sacar
  // a alguien) para que no pueda abrir lo que se escriba desde ahora.
  if (!input.rotation) return c.json({ error: "rotation-required" }, 400);
  const household = await c.env.DB.prepare("select adults_key_version as adults from households where id = ?").bind(householdId).first<{ adults: number }>();
  const adultsAfter = await c.env.DB.prepare("select user_id as userId from memberships where household_id = ? and user_id <> ? and role <> 'kid'")
    .bind(householdId, targetId)
    .all<{ userId: string }>();
  if (!household) return c.json({ error: "not-found" }, 404);
  if (input.rotation.version !== household.adults + 1) return c.json({ error: "stale-key" }, 409);
  const expected = adultsAfter.results.map((member) => member.userId);
  const given = input.rotation.envelopes.map((envelope) => envelope.userId);
  if (new Set(given).size !== given.length || given.length !== expected.length || !expected.every((id) => given.includes(id))) {
    return c.json({ error: "members-changed" }, 409);
  }
  const now = Date.now();
  await c.env.DB.batch([
    setRole,
    c.env.DB.prepare("delete from key_envelopes where household_id = ? and recipient_user_id = ? and scope = 'adults'").bind(householdId, targetId),
    ...input.rotation.envelopes.map((envelope) =>
      c.env.DB.prepare(
        "insert into key_envelopes (household_id, scope, version, recipient_user_id, envelope, created_by, created_at) values (?, 'adults', ?, ?, ?, ?, ?)",
      ).bind(householdId, input.rotation!.version, envelope.userId, envelope.envelope, user.id, now),
    ),
    c.env.DB.prepare("update households set adults_key_version = ? where id = ?").bind(input.rotation.version, householdId),
    // Las invitaciones pendientes llevaban la clave de Adultos vieja.
    c.env.DB.prepare("delete from invites where household_id = ? and used_at is null").bind(householdId),
  ]);
  return c.json({ ok: true });
});

/**
 * Entregar claves a otro miembro (ej. al pasar de chico a adulto, se le entrega "Adultos").
 * El servidor no puede verificar el contenido. Sí exige que entregue un admin, que el destinatario
 * pueda tener ese nivel según su rol y que sea la versión vigente. Nunca pisa un sobre que ya
 * existe: si no, cualquiera de la casa podría dejar a otro sin sus claves, o cargarle una versión
 * futura que después trabe la rotación al sacar a alguien.
 */
app.post("/households/:id/envelopes", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  const body = (await c.req.json().catch(() => null)) as { recipientUserId?: unknown; envelopes?: unknown } | null;
  const recipientId = userId.safeParse(body?.recipientUserId);
  const envelopes = envelopeInput.array().min(1).max(2).safeParse(body?.envelopes);
  if (!recipientId.success || !envelopes.success) return c.json({ error: "invalid" }, 400);
  const [recipient, household] = await Promise.all([
    membership(c.env, householdId, recipientId.data),
    c.env.DB.prepare("select family_key_version as family, adults_key_version as adults from households where id = ?").bind(householdId).first<{ family: number; adults: number }>(),
  ]);
  if (!recipient || !household) return c.json({ error: "not-found" }, 404);
  const allowed = envelopes.data.every((entry) => entry.scope !== "private" && scopesFor(recipient.role).includes(entry.scope));
  if (!allowed) return c.json({ error: "forbidden" }, 403);
  if (envelopes.data.some((entry) => entry.version !== household[entry.scope as "family" | "adults"])) return c.json({ error: "stale-key" }, 409);
  const now = Date.now();
  await c.env.DB.batch(
    envelopes.data.map((entry) =>
      c.env.DB.prepare(
        "insert into key_envelopes (household_id, scope, version, recipient_user_id, envelope, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?) on conflict do nothing",
      ).bind(householdId, entry.scope, entry.version, recipientId.data, entry.envelope, user.id, now),
    ),
  );
  return c.json({ ok: true });
});

// --- Invitaciones -------------------------------------------------------------------------

app.post("/households/:id/invites", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  const input = await parse(c, createInviteInput);
  if (!input || (input.kind === "device" && input.role !== "kid")) return c.json({ error: "invalid" }, 400);
  const now = Date.now();
  const expiresAt = now + (input.kind === "device" ? DEVICE_LINK_MINUTES * 60_000 : input.expiresInDays * DAY);
  await c.env.DB.prepare(
    "insert into invites (id, household_id, role, kind, token_hash, wrapped_keys, created_by, created_at, expires_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(input.id, householdId, input.role, input.kind, input.tokenHash, input.wrappedKeys, user.id, now, expiresAt)
    .run();
  return c.json({ id: input.id, expiresAt }, 201);
});

app.get("/households/:id/invites", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  const invites = await c.env.DB.prepare(
    "select id, role, kind, created_at as createdAt, expires_at as expiresAt, used_at as usedAt from invites where household_id = ? and (used_at is null and expires_at > ?) order by created_at desc",
  )
    .bind(householdId, Date.now())
    .all();
  return c.json({ invites: invites.results });
});

app.delete("/households/:id/invites/:inviteId", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  await c.env.DB.prepare("delete from invites where id = ? and household_id = ?").bind(c.req.param("inviteId"), householdId).run();
  return c.json({ ok: true });
});

/** Valida el token de una invitación (sin sesión: se usa antes de crear la cuenta). */
async function findInvite(env: Env, id: string, authToken: string) {
  const invite = await env.DB.prepare(
    `select i.id, i.household_id as householdId, i.role, i.kind, i.token_hash as tokenHash, i.wrapped_keys as wrappedKeys, i.expires_at as expiresAt, i.used_at as usedAt, u.name as inviterName
       from invites i join "user" u on u.id = i.created_by where i.id = ?`,
  )
    .bind(id)
    .first<{ id: string; householdId: string; role: Role; kind: "account" | "device"; tokenHash: string; wrappedKeys: string; expiresAt: number; usedAt: number | null; inviterName: string }>();
  // Mismo error para "no existe" y "token incorrecto": no se puede averiguar qué invitaciones hay.
  if (!invite || !timingSafeEqual(invite.tokenHash, await sha256(authToken))) return { error: "not-found" as const };
  if (invite.usedAt) return { error: "used" as const };
  if (invite.expiresAt < Date.now()) return { error: "expired" as const };
  return { invite };
}

app.post("/invites/:id/preview", async (c) => {
  const input = await parse(c, inviteTokenInput);
  if (!input || !uuid.safeParse(c.req.param("id")).success) return c.json({ error: "invalid" }, 400);
  const found = await findInvite(c.env, c.req.param("id"), input.authToken);
  if ("error" in found) return c.json({ error: found.error }, found.error === "not-found" ? 404 : 410);
  const { invite } = found;
  return c.json({ householdId: invite.householdId, role: invite.role, kind: invite.kind, wrappedKeys: invite.wrappedKeys, inviterName: invite.inviterName, expiresAt: invite.expiresAt });
});

app.post("/invites/:id/accept", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const input = await parse(c, acceptInviteInput);
  if (!input || !uuid.safeParse(c.req.param("id")).success) return c.json({ error: "invalid" }, 400);
  const found = await findInvite(c.env, c.req.param("id"), input.authToken);
  if ("error" in found) return c.json({ error: found.error }, found.error === "not-found" ? 404 : 410);
  const { invite } = found;
  if (invite.kind === "device") return c.json({ error: "device-link" }, 400);
  if (await membership(c.env, invite.householdId, user.id)) return c.json({ error: "already-member" }, 409);
  const hasKeys = await c.env.DB.prepare("select 1 from user_keys where user_id = ?").bind(user.id).first();
  if (!hasKeys) return c.json({ error: "no-keys" }, 409);

  const household = await c.env.DB.prepare("select family_key_version as family, adults_key_version as adults from households where id = ?")
    .bind(invite.householdId)
    .first<{ family: number; adults: number }>();
  if (!household) return c.json({ error: "not-found" }, 404);
  if (!validEnvelopes(invite.role, input.envelopes, household)) return c.json({ error: "invalid-envelopes" }, 400);

  const pending = await c.env.DB.prepare("select 1 from join_requests where household_id = ? and user_id = ?").bind(invite.householdId, user.id).first();
  if (pending) return c.json({ error: "already-requested" }, 409);

  const now = Date.now();
  // Abrir el link no hace miembro a nadie: queda un pedido que un admin aprueba. El "used_at is
  // null" en el update hace que dos aceptaciones simultáneas no dejen dos pedidos.
  const results = await c.env.DB.batch([
    c.env.DB.prepare("update invites set used_at = ?, used_by = ? where id = ? and used_at is null").bind(now, user.id, invite.id),
    c.env.DB.prepare(
      "insert into join_requests (invite_id, household_id, user_id, role, envelopes, created_at) select ?, ?, ?, ?, ?, ? where changes() = 1",
    ).bind(invite.id, invite.householdId, user.id, invite.role, JSON.stringify(input.envelopes), now),
  ]);
  if (results[0].meta.changes === 0) return c.json({ error: "used" }, 410);
  return c.json({ householdId: invite.householdId, role: invite.role, pending: true }, 202);
});

/** ¿Es el celular de un chico (entra con su llave, sin email ni contraseña)? */
async function isDevice(env: Env, userId: string) {
  return Boolean(await env.DB.prepare(`select 1 from "deviceKey" where "userId" = ?`).bind(userId).first());
}

/** Los sobres que sube quien entra: solo los niveles de su rol, en la versión vigente, y Familia siempre. */
function validEnvelopes(role: Role, envelopes: { scope: Scope; version: number }[], household: { family: number; adults: number }) {
  const allowed = scopesFor(role);
  const current = (scope: Scope) => (scope === "private" ? 1 : household[scope as "family" | "adults"]);
  return envelopes.every((entry) => allowed.includes(entry.scope) && entry.version === current(entry.scope)) && envelopes.some((entry) => entry.scope === "family");
}

/**
 * Vincular el celular de un chico con el código que mostró un adulto. Crea una cuenta sin email ni
 * contraseña: el id al azar que eligió el celular, las claves públicas que generó el celular y su llave para entrar. Como
 * una invitación, queda un pedido que un admin aprueba. Después el celular entra con
 * `/api/auth/device/sign-in`.
 */
app.post("/devices/link", async (c) => {
  if (await tooMany(c.env, `device-link:${clientIp(c)}`, 10, RECOVERY_WINDOW)) return c.json({ error: "rate-limited" }, 429);
  const input = await parse(c, deviceLinkInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const found = await findInvite(c.env, input.inviteId, input.authToken);
  if ("error" in found) return c.json({ error: found.error }, found.error === "not-found" ? 404 : 410);
  const { invite } = found;
  if (invite.kind !== "device" || invite.role !== "kid") return c.json({ error: "not-device-link" }, 400);
  const household = await c.env.DB.prepare("select family_key_version as family, adults_key_version as adults from households where id = ?")
    .bind(invite.householdId)
    .first<{ family: number; adults: number }>();
  if (!household) return c.json({ error: "not-found" }, 404);
  if (!validEnvelopes(invite.role, input.envelopes, household)) return c.json({ error: "invalid-envelopes" }, 400);

  const { userId } = input;
  if (await c.env.DB.prepare(`select 1 from "user" where id = ?`).bind(userId).first()) return c.json({ error: "invalid" }, 400);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  // Primero se usa el código (una sola vez, aunque lleguen dos a la par); después se crea la cuenta.
  const claimed = await c.env.DB.prepare("update invites set used_at = ?, used_by = ? where id = ? and used_at is null").bind(now, userId, invite.id).run();
  if (!claimed.meta.changes) return c.json({ error: "used" }, 410);
  await c.env.DB.batch([
    c.env.DB.prepare(`insert into "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt") values (?, '', ?, 0, null, ?, ?)`).bind(
      userId,
      `device-${userId}@device.invalid`,
      iso,
      iso,
    ),
    c.env.DB.prepare(
      "insert into user_keys (user_id, kdf_version, enc_public_key, sign_public_key, private_keys, recovery_private_keys, recovery_verifier, created_at, updated_at) values (?, 1, ?, ?, '', '', null, ?, ?)",
    ).bind(userId, input.encPublicKey, input.signPublicKey, now, now),
    c.env.DB.prepare(`insert into "deviceKey" ("id", "userId", "publicKey", "createdAt") values (?, ?, ?, ?)`).bind(crypto.randomUUID(), userId, input.devicePublicKey, iso),
    c.env.DB.prepare("insert into join_requests (invite_id, household_id, user_id, role, envelopes, created_at) values (?, ?, ?, ?, ?, ?)").bind(
      invite.id,
      invite.householdId,
      userId,
      invite.role,
      JSON.stringify(input.envelopes),
      now,
    ),
  ]);
  return c.json({ userId, householdId: invite.householdId, role: invite.role, pending: true }, 202);
});

app.get("/households/:id/join-requests", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  const requests = await c.env.DB.prepare(
    `select r.invite_id as id, r.role, r.created_at as createdAt, u.name,
            case when d."id" is null then u.email else '' end as email, d."id" is not null as device
       from join_requests r join "user" u on u.id = r.user_id left join "deviceKey" d on d."userId" = r.user_id
      where r.household_id = ? order by r.created_at`,
  )
    .bind(householdId)
    .all();
  return c.json({ requests: requests.results });
});

app.post("/households/:id/join-requests/:inviteId/approve", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  const request = await c.env.DB.prepare("select user_id as userId, role, envelopes from join_requests where invite_id = ? and household_id = ?")
    .bind(c.req.param("inviteId"), householdId)
    .first<{ userId: string; role: Role; envelopes: string }>();
  if (!request) return c.json({ error: "not-found" }, 404);
  const household = await c.env.DB.prepare("select family_key_version as family, adults_key_version as adults from households where id = ?")
    .bind(householdId)
    .first<{ family: number; adults: number }>();
  if (!household) return c.json({ error: "not-found" }, 404);
  const envelopes = JSON.parse(request.envelopes) as { scope: Scope; version: number; envelope: string }[];
  // Si las claves cambiaron mientras esperaba (alguien salió de la casa), sus sobres ya no sirven:
  // el pedido se descarta y hace falta una invitación nueva.
  const current = envelopes.every((entry) => entry.version === (entry.scope === "private" ? 1 : household[entry.scope as "family" | "adults"]));
  if (!current) {
    await c.env.DB.batch([
      c.env.DB.prepare("delete from join_requests where invite_id = ?").bind(c.req.param("inviteId")),
      c.env.DB.prepare(`delete from "user" where id = ? and exists (select 1 from "deviceKey" where "userId" = ?) and not ${inHouseholds(`"user".id`)}`).bind(request.userId, request.userId),
    ]);
    return c.json({ error: "stale" }, 409);
  }
  if (await membership(c.env, householdId, request.userId)) return c.json({ error: "already-member" }, 409);

  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare("delete from join_requests where invite_id = ?").bind(c.req.param("inviteId")),
    c.env.DB.prepare("insert into memberships (household_id, user_id, role, joined_at) select ?, ?, ?, ? where changes() = 1").bind(householdId, request.userId, request.role, now),
    ...envelopes.map((entry) =>
      c.env.DB.prepare(
        "insert into key_envelopes (household_id, scope, version, recipient_user_id, envelope, created_by, created_at) select ?, ?, ?, ?, ?, ?, ? where exists (select 1 from memberships where household_id = ? and user_id = ?)",
      ).bind(householdId, entry.scope, entry.version, request.userId, entry.envelope, request.userId, now, householdId, request.userId),
    ),
  ]);
  return c.json({ ok: true });
});

app.delete("/households/:id/join-requests/:inviteId", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  const request = await c.env.DB.prepare("select user_id as userId from join_requests where invite_id = ? and household_id = ?")
    .bind(c.req.param("inviteId"), householdId)
    .first<{ userId: string }>();
  await c.env.DB.batch([
    c.env.DB.prepare("delete from join_requests where invite_id = ? and household_id = ?").bind(c.req.param("inviteId"), householdId),
    // Un celular rechazado no tiene otra casa ni email: su cuenta se borra entera.
    c.env.DB.prepare(`delete from "user" where id = ? and exists (select 1 from "deviceKey" where "userId" = ?) and not ${inHouseholds(`"user".id`)}`).bind(
      request?.userId ?? "",
      request?.userId ?? "",
    ),
  ]);
  return c.json({ ok: true });
});

// --- Sincronización -----------------------------------------------------------------------

function householdLog(env: Env, householdId: string) {
  return env.HOUSEHOLD.get(env.HOUSEHOLD.idFromName(householdId));
}

/**
 * Subir cambios. El servidor no los lee, pero exige: ser miembro, poder escribir en ese nivel
 * (un chico no escribe en "Adultos"), la versión vigente de la clave y la firma de quien tiene la
 * sesión. Con una cookie robada sola no alcanza: sin la clave privada de la persona, no se escribe.
 */
app.post("/households/:id/ops", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if (!uuid.safeParse(householdId).success) return c.json({ error: "not-found" }, 404);
  const member = await membership(c.env, householdId, user.id);
  if (!member) return c.json({ error: "not-found" }, 404);
  await touchHousehold(c.env, householdId);
  if (Number(c.req.header("Content-Length") ?? 0) > SYNC_LIMITS.pushBytes) return c.json({ error: "too-large" }, 413);
  const input = await parse(c, pushInput);
  if (!input) return c.json({ error: "invalid" }, 400);

  const [household, keys, quotas] = await Promise.all([
    c.env.DB.prepare(
      "select h.family_key_version as family, h.adults_key_version as adults, coalesce(p.status, 'active') as planStatus from households h left join household_plans p on p.household_id = h.id where h.id = ?",
    )
      .bind(householdId)
      .first<{ family: number; adults: number; planStatus: string }>(),
    c.env.DB.prepare("select sign_public_key as signPublicKey from user_keys where user_id = ?").bind(user.id).first<{ signPublicKey: string }>(),
    quotasOn(c.env) ? householdQuotas(c.env.DB, householdId) : null,
  ]);
  if (!household || !keys) return c.json({ error: "not-found" }, 404);
  // Casa en pausa (plan vencido o pausado): se puede bajar todo, pero no subir.
  if (household.planStatus === "paused") return c.json({ error: "plan-paused" }, 402);
  const allowed = scopesFor(member.role);
  for (const op of input.ops) {
    if (!allowed.includes(op.scope)) return c.json({ error: "forbidden-scope" }, 403);
    const current = op.scope === "private" ? 1 : household[op.scope];
    if (op.keyVersion !== current) return c.json({ error: "stale-key" }, 409);
  }
  const signed = await Promise.all(input.ops.map((op) => verifySignature(keys.signPublicKey, opSigningData(householdId, op, user.id), op.sig)));
  if (signed.some((ok) => !ok)) return c.json({ error: "bad-signature" }, 400);

  try {
    return c.json(await householdLog(c.env, householdId).push(user.id, input.ops, quotas && { opsPerDay: quotas.opsPerDay, logBytes: quotas.logBytes }));
  } catch (error) {
    if (error instanceof Error && error.message === OP_CONFLICT) return c.json({ error: "conflict" }, 409);
    // Tope de la casa: el lote no entró y el dispositivo lo guarda para más tarde. 507 como las
    // fotos: un 429 lo toma la app como "demasiados intentos" y no vería el motivo.
    const kind = quotaKind(error);
    if (kind) {
      await recordQuotaHit(c.env.DB, householdId, kind);
      return c.json({ error: QUOTA_EXCEEDED }, 507);
    }
    throw error;
  }
});

// --- Fotos (cifradas en el dispositivo) ------------------------------------------------------
//
// Cada foto tiene su propia clave, que viaja DENTRO del registro sincronizado (cifrado con el nivel
// de su receta). Acá solo llegan bytes cifrados: el proveedor no puede ver ninguna foto. Se pide
// ser miembro de la casa para subir, bajar o borrar.

const PHOTO_VARIANTS = ["full", "thumb"] as const;
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
const photoKey = (householdId: string, photoId: string, variant: string) => `households/${householdId}/photos/${photoId}/${variant}`;

function photoStorageFailure(c: Context<AppEnv>, error: unknown) {
  if (error instanceof PhotoStorageError) {
    console.error(`[photo-storage] ${error.operation} failed with status ${error.status}`);
    if (error.status === 413) return c.json({ error: "too-large" }, 413);
    if (error.status === 429) return c.json({ error: "storage-rate-limited" }, 429);
    if (error.status === 402 || error.status === 507) return c.json({ error: "storage-quota" }, 507);
  } else {
    console.error("[photo-storage] unexpected failure", error);
  }
  return c.json({ error: "storage-unavailable" }, 503);
}

/** Miembro de la casa y foto bien nombrada; si no, la respuesta de error. */
async function photoAccess(c: Context<AppEnv>) {
  const user = await requireUser(c);
  if (!user) return { error: c.json({ error: "unauthorized" }, 401) };
  const { id: householdId, photoId, variant } = c.req.param() as { id: string; photoId: string; variant?: string };
  if (!uuid.safeParse(householdId).success || !uuid.safeParse(photoId).success || (variant && !(PHOTO_VARIANTS as readonly string[]).includes(variant))) {
    return { error: c.json({ error: "not-found" }, 404) };
  }
  const member = await membership(c.env, householdId, user.id);
  if (!member) return { error: c.json({ error: "not-found" }, 404) };
  await touchHousehold(c.env, householdId);
  return { user, member, householdId, photoId, variant: variant ?? "full" };
}

app.put("/households/:id/photos/:photoId/:variant", async (c) => {
  const access = await photoAccess(c);
  if ("error" in access) return access.error;
  const { member, householdId, photoId, variant } = access;
  if (member.role === "kid") return c.json({ error: "forbidden" }, 403);
  const plan = await c.env.DB.prepare("select status from household_plans where household_id = ?").bind(householdId).first<{ status: string }>();
  if (plan?.status === "paused") return c.json({ error: "plan-paused" }, 402);
  if (Number(c.req.header("Content-Length") ?? 0) > PHOTO_MAX_BYTES) return c.json({ error: "too-large" }, 413);
  const body = await c.req.arrayBuffer();
  // iv (12) + etiqueta de AES-GCM (16): menos que eso no es una foto cifrada.
  if (body.byteLength > PHOTO_MAX_BYTES) return c.json({ error: "too-large" }, 413);
  if (body.byteLength < 29) return c.json({ error: "invalid" }, 400);
  if (quotasOn(c.env)) {
    // Lo que ya ocupa la casa, sin contar la versión anterior de esta misma foto (se reemplaza).
    const [used, quotas] = await Promise.all([
      c.env.DB.prepare("select coalesce(sum(bytes), 0) as bytes from photo_objects where household_id = ? and not (photo_id = ? and variant = ?)")
        .bind(householdId, photoId, variant)
        .first<{ bytes: number }>(),
      householdQuotas(c.env.DB, householdId),
    ]);
    if ((used?.bytes ?? 0) + body.byteLength > quotas.photoBytes) {
      await recordQuotaHit(c.env.DB, householdId, "photos");
      return c.json({ error: "storage-quota" }, 507);
    }
  }
  const key = photoKey(householdId, photoId, variant);
  try {
    await photoStorage(c.env).put(key, body);
  } catch (error) {
    return photoStorageFailure(c, error);
  }
  await c.env.DB.prepare(
    "insert into photo_objects (household_id, photo_id, variant, bytes, created_at) values (?, ?, ?, ?, ?) on conflict (household_id, photo_id, variant) do update set bytes = excluded.bytes",
  )
    .bind(householdId, photoId, variant, body.byteLength, Date.now())
    .run();
  return c.json({ ok: true });
});

app.get("/households/:id/photos/:photoId/:variant", async (c) => {
  const access = await photoAccess(c);
  if ("error" in access) return access.error;
  try {
    const object = await photoStorage(c.env).get(photoKey(access.householdId, access.photoId, access.variant));
    if (!object) return c.json({ error: "not-found" }, 404);
    return new Response(object.body, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" } });
  } catch (error) {
    return photoStorageFailure(c, error);
  }
});

/** Borrar una foto (las dos variantes): quien puede administrar recetas. */
app.delete("/households/:id/photos/:photoId", async (c) => {
  const access = await photoAccess(c);
  if ("error" in access) return access.error;
  const { member, householdId, photoId } = access;
  if (member.role === "kid") return c.json({ error: "forbidden" }, 403);
  const keys = PHOTO_VARIANTS.map((variant) => photoKey(householdId, photoId, variant));
  try {
    await photoStorage(c.env).delete(keys);
  } catch (error) {
    return photoStorageFailure(c, error);
  }
  await c.env.DB.prepare("delete from photo_objects where household_id = ? and photo_id = ?").bind(householdId, photoId).run();
  return c.json({ ok: true });
});

/** Bajar cambios desde `since`: solo los niveles que la persona puede abrir. */
app.get("/households/:id/ops", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if (!uuid.safeParse(householdId).success) return c.json({ error: "not-found" }, 404);
  const member = await membership(c.env, householdId, user.id);
  if (!member) return c.json({ error: "not-found" }, 404);
  await touchHousehold(c.env, householdId);
  const query = pullQuery.safeParse(c.req.query());
  if (!query.success) return c.json({ error: "invalid" }, 400);
  return c.json(await householdLog(c.env, householdId).pull({ userId: user.id, adults: member.role !== "kid", ...query.data }));
});

// --- Administración (licencias y planes) -----------------------------------------------------
//
// Operador independiente: clave aleatoria + TOTP y sesión revocable. Sin proveedores externos.
// Nunca ve contenido de las casas (está cifrado igual).

const admin = new Hono<AppEnv>();
app.route("/admin/auth", operatorAuth);

admin.use("*", async (c, next) => {
  if (!operatorRequestAllowed(c.req.raw, c.env)) return c.json({ error: "not-found" }, 404);
  const email = await operatorSession(c.req.raw, c.env);
  if (!email) return c.json({ error: "not-found" }, 404);
  c.set("operatorEmail", email);
  return next();
});
admin.use("*", bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: "too-large" }, 413) }));

const LICENSE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1: no se confunden al dictarlo

/** Consulta operativa: nunca otorga privilegios a cuentas domésticas. */
admin.get("/accounts", async (c) => {
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email || email.length > 254) return c.json({ error: "invalid" }, 400);
  const result = await c.env.DB.prepare('select id, email, name, "createdAt" from "user" where lower(email) = ?').bind(email).all();
  return c.json({ accounts: result.results });
});

/** Código nuevo: "OD-XXXX-XXXX-XXXX-XXXX" (80 bits al azar). */
function newLicenseCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((byte) => LICENSE_ALPHABET[byte % 32]).join("");
  return `OD-${chars.match(/.{4}/g)!.join("-")}`;
}

async function issueLicenses(env: Env, input: z.infer<typeof createLicensesInput>) {
  const now = Date.now();
  const expiresAt = input.expiresInDays ? now + input.expiresInDays * DAY : null;
  const licenses = Array.from({ length: input.count }, () => ({ id: crypto.randomUUID(), code: newLicenseCode() }));
  await env.DB.batch(
    await Promise.all(
      licenses.map(async ({ id, code }) =>
        env.DB.prepare(
          "insert into cloud_licenses (id, code_hash, plan, max_households, expires_at, source, external_id, note, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(id, await sha256(normalizeLicenseCode(code)), input.plan, input.maxHouseholds, expiresAt, input.source, input.externalId ?? null, input.note ?? null, now),
      ),
    ),
  );
  return licenses.map(({ id, code }) => ({ id, code, plan: input.plan, expiresAt }));
}

async function audit(c: Context<AppEnv>, action: string, targetType: string, targetId: string, details?: Record<string, unknown>) {
  await c.env.DB.prepare("insert into admin_audit (id, actor_user_id, action, target_type, target_id, details, created_at) values (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), null, action, targetType, targetId, JSON.stringify({ ...details, operatorEmail: c.var.operatorEmail }), Date.now())
    .run();
}

async function setHouseholdStatus(env: Env, householdId: string, status: "active" | "paused") {
  return env.DB.prepare(
    `insert into household_plans (household_id, plan, status, updated_at) select id, 'beta', ?, ? from households where id = ?
       on conflict (household_id) do update set status = excluded.status, updated_at = excluded.updated_at`,
  )
    .bind(status, Date.now(), householdId)
    .run();
}

// --- Feedback público y operaciones privadas por CLI ---------------------------------------------

const requirePublisher = async (c: Context<AppEnv>) => {
  const user = await requireUser(c);
  return user && !await isDevice(c.env, user.id) ? user : null;
};
app.route("/", projectShares(requirePublisher, tooMany));
app.route("/", contentShares(requirePublisher, tooMany));

app.post("/feedback", async (c) => {
  const input = await parse(c, feedbackInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await tooMany(c.env, `feedback:ip:${clientIp(c)}`, 5, DAY)) return c.json({ error: "rate-limited" }, 429);
  const user = await requireUser(c);
  const now = Date.now();
  await c.env.DB.prepare("insert into feedback (id, user_id, email, category, message, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), user?.id ?? null, user?.email ?? input.email ?? null, input.category, input.message, now, now)
    .run();
  return c.json({ ok: true }, 201);
});

/**
 * Lista de espera de la nube, sin cuenta: nombre y email. La respuesta es la misma si el email ya
 * estaba, así no se puede averiguar quién se anotó. El operador habilita desde /admin.
 */
app.post("/waitlist", async (c) => {
  const input = await parse(c, waitlistInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await tooMany(c.env, `waitlist:ip:${clientIp(c)}`, 5, DAY)) return c.json({ error: "rate-limited" }, 429);
  const day = new Date().toISOString().slice(0, 10);
  await c.env.DB.batch([
    c.env.DB.prepare("insert into cloud_waitlist (id, name, email, created_at) values (?, ?, ?, ?) on conflict (email) do nothing")
      .bind(crypto.randomUUID(), input.name, input.email, Date.now()),
    c.env.DB.prepare("insert into daily_metrics (day, metric, count) values (?, 'waitlist_submit', 1) on conflict (day, metric) do update set count = count + 1")
      .bind(day),
  ]);
  return c.json({ ok: true }, 201);
});

app.post("/pulse", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { metric?: unknown } | null;
  if (!body || typeof body.metric !== "string" || !(PULSE_METRICS as readonly string[]).includes(body.metric)) {
    return c.json({ error: "invalid" }, 400);
  }
  const day = new Date().toISOString().slice(0, 10);
  await c.env.DB.prepare(
    "insert into daily_metrics (day, metric, count) values (?, ?, 1) on conflict (day, metric) do update set count = count + 1",
  )
    .bind(day, body.metric)
    .run();
  return c.json({ ok: true });
});

const platformAdmin = new Hono<AppEnv>();

platformAdmin.get("/overview", async (c) => {
  await processInactivity(c.env);
  const nowIso = new Date().toISOString();
  const [users, households, sessions, licenses, feedback, notices, waiting, rateSignals, sessionSignals, auditRows] = await Promise.all([
    c.env.DB.prepare(`select count(*) as count from "user"`).first<{ count: number }>(),
    c.env.DB.prepare(
      `select count(*) as total,
              sum(case when coalesce(p.status, 'active') = 'active' then 1 else 0 end) as active,
              sum(case when p.status = 'paused' then 1 else 0 end) as paused
         from households h left join household_plans p on p.household_id = h.id`,
    ).first<{ total: number; active: number; paused: number }>(),
    c.env.DB.prepare(`select count(*) as count from "session" where "expiresAt" > ?`).bind(nowIso).first<{ count: number }>(),
    c.env.DB.prepare(
      `select count(*) as total,
              sum(case when status = 'active' and used < max_households and (expires_at is null or expires_at > ?) then 1 else 0 end) as available
         from cloud_licenses`,
    ).bind(Date.now()).first<{ total: number; available: number }>(),
    c.env.DB.prepare("select count(*) as count from feedback where status = 'open'").first<{ count: number }>(),
    c.env.DB.prepare("select count(*) as count from inactivity_notices where status = 'pending'").first<{ count: number }>(),
    c.env.DB.prepare("select count(*) as count from cloud_waitlist where status = 'waiting'").first<{ count: number }>(),
    c.env.DB.prepare(
      `select case
                when key like 'recovery:ip:%' then 'recovery-ip'
                when key like 'recovery:email:%' then 'recovery-email'
                when key like 'license-check:%' then 'license-check'
                when key like 'feedback:ip:%' then 'feedback'
                when key like 'waitlist:ip:%' then 'waitlist'
                when key like 'password:%' then 'password'
                else 'other'
              end as type,
              count(*) as sources,
              max(count) as maxCount
         from attempts where window_start >= ? and count >= 5 group by type order by maxCount desc`,
    ).bind(Date.now() - DAY).all<{ type: string; sources: number; maxCount: number }>(),
    c.env.DB.prepare(
      `select u.id as userId, u.email, count(s.id) as sessions
         from "user" u join "session" s on s."userId" = u.id and s."expiresAt" > ?
        group by u.id, u.email having count(s.id) > 5 order by sessions desc`,
    ).bind(nowIso).all<{ userId: string; email: string; sessions: number }>(),
    c.env.DB.prepare(
      `select a.action, a.target_type as targetType, a.target_id as targetId, a.created_at as createdAt, coalesce(json_extract(a.details, '$.operatorEmail'), u.email) as actorEmail
         from admin_audit a left join "user" u on u.id = a.actor_user_id order by a.created_at desc limit 20`,
    ).all(),
  ]);
  return c.json({
    metrics: {
      users: users?.count ?? 0,
      households: households?.total ?? 0,
      activeHouseholds: households?.active ?? 0,
      pausedHouseholds: households?.paused ?? 0,
      activeSessions: sessions?.count ?? 0,
      licenses: licenses?.total ?? 0,
      availableLicenses: licenses?.available ?? 0,
      openFeedback: feedback?.count ?? 0,
      pendingNotices: notices?.count ?? 0,
      waiting: waiting?.count ?? 0,
    },
    risks: [...rateSignals.results, ...sessionSignals.results.map((signal) => ({ type: "many-sessions", ...signal }))],
    credentials: {
      operatorConfigured: operatorConfigured(c.env),
      supabaseConfigured: Boolean(c.env.SUPABASE_SERVICE_ROLE_KEY),
      mail: mailConfigState(c.env),
    },
    recentAudit: auditRows.results,
  });
});

/**
 * La cuenta está o estuvo en una casa que sigue existiendo. Borrarla dejaría una casa sin quien la
 * administra, y de quien se fue quedan su firma y su rol para verificar sus cambios viejos.
 */
const inHouseholds = (user: string) => `(exists (select 1 from memberships where user_id = ${user})
  or exists (select 1 from former_members where user_id = ${user})
  or exists (select 1 from households where created_by = ${user})
  or exists (select 1 from invites where created_by = ${user}))`;

platformAdmin.get("/users", async (c) => {
  const rows = await c.env.DB.prepare(
    `select u.id, u.name, u.email, u."createdAt" as createdAt,
            count(distinct m.household_id) as households,
            count(distinct case when s."expiresAt" > ? then s.id end) as activeSessions,
            max(s."updatedAt") as lastSessionAt,
            coalesce(u."twoFactorEnabled", 0) as twoFactorEnabled,
            (select count(*) from "passkey" p where p."userId" = u.id) as passkeys,
            case when ${inHouseholds("u.id")} then 0 else 1 end as deletable
       from "user" u
       left join memberships m on m.user_id = u.id
       left join "session" s on s."userId" = u.id
      group by u.id, u.name, u.email, u."createdAt", u."twoFactorEnabled"
      order by u."createdAt" desc`,
  )
    .bind(new Date().toISOString())
    .all();
  return c.json({ users: rows.results });
});

/**
 * Ayudar a alguien a volver a entrar, sin tocar sus claves ni sus datos (están cifrados):
 * - two-factor: quita los dos pasos (código, códigos de respaldo y llaves que solo eran segundo paso).
 * - passkeys: quita todas sus llaves de acceso, también las que entran sin contraseña (teléfono perdido).
 * - sessions: cierra la cuenta en todos los dispositivos.
 * La contraseña no se cambia desde acá: de ella sale la clave que abre sus datos. Con el kit, la
 * persona la cambia sola; sin el kit, sus claves no se pueden recuperar.
 */
const userResets: Record<string, (env: Env, id: string) => D1PreparedStatement[]> = {
  "two-factor": (env, id) => [
    env.DB.prepare(`delete from "twoFactor" where "userId" = ?`).bind(id),
    env.DB.prepare(`update "user" set "twoFactorEnabled" = 0 where "id" = ?`).bind(id),
    env.DB.prepare(`delete from "passkey" where "userId" = ? and "id" not in (select "passkeyId" from "passkeyUnlock")`).bind(id),
  ],
  passkeys: (env, id) => [env.DB.prepare(`delete from "passkey" where "userId" = ?`).bind(id)],
  sessions: (env, id) => [env.DB.prepare(`delete from "session" where "userId" = ?`).bind(id)],
};

for (const [action, statements] of Object.entries(userResets)) {
  platformAdmin.post(`/users/:id/reset/${action}`, async (c) => {
    const id = c.req.param("id");
    const user = await c.env.DB.prepare(`select id, email from "user" where "id" = ?`).bind(id).first<{ id: string; email: string }>();
    if (!user) return c.json({ error: "not-found" }, 404);
    const event = action === "two-factor" ? "twoFactor" : action === "passkeys" ? "passkeys" : "sessions";
    await c.env.DB.batch([...statements(c.env, id), ...securityEmailStatements(c.env, user, event)]);
    await audit(c, `user.reset.${action}`, "user", id);
    return c.json({ ok: true });
  });
}

/**
 * Borrar una cuenta sin casas, confirmando con su email: así se puede volver a crear (por ejemplo,
 * si se perdieron la contraseña y el kit). Sesiones, claves, llaves y dos pasos se van en cascada.
 */
platformAdmin.delete("/users/:id", async (c) => {
  const id = c.req.param("id");
  const input = await parse(c, deleteUserInput);
  if (!input) return c.json({ error: "confirmation-required" }, 400);
  const user = await c.env.DB.prepare(`select email from "user" where id = ?`).bind(id).first<{ email: string }>();
  if (!user) return c.json({ error: "not-found" }, 404);
  if (input.confirm !== user.email.toLowerCase()) return c.json({ error: "confirmation-required" }, 400);
  // La condición va en el mismo delete: si entró a una casa recién, no se borra.
  const result = await c.env.DB.prepare(`delete from "user" where id = ? and not ${inHouseholds(`"user".id`)}`).bind(id).run();
  if (!result.meta.changes) return c.json({ error: "has-households" }, 409);
  await audit(c, "user.delete", "user", id);
  return c.json({ ok: true });
});

platformAdmin.get("/households", async (c) => {
  const rows = await c.env.DB.prepare(
    `select h.id, h.created_at as createdAt, coalesce(h.last_activity_at, h.created_at) as lastActivityAt,
            coalesce(p.plan, 'beta') as plan, coalesce(p.status, 'active') as status,
            (select count(*) from memberships m where m.household_id = h.id) as members,
            l.note as licenseNote,
            case when coalesce(p.status, 'active') = 'paused' and coalesce(h.last_activity_at, h.created_at) <= ? then 1 else 0 end as deletionEligible
       from households h
       left join household_plans p on p.household_id = h.id
       left join cloud_licenses l on l.id = p.license_id
      order by coalesce(h.last_activity_at, h.created_at) asc`,
  )
    .bind(inactiveBefore(Date.now()))
    .all();
  return c.json({ households: rows.results });
});

platformAdmin.get("/licenses", async (c) => {
  const rows = await c.env.DB.prepare(
    "select id, plan, max_households as maxHouseholds, used, status, expires_at as expiresAt, source, note, created_at as createdAt from cloud_licenses order by created_at desc",
  ).all();
  return c.json({ licenses: rows.results });
});

platformAdmin.post("/licenses", async (c) => {
  const input = await parse(c, createLicensesInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const licenses = await issueLicenses(c.env, input);
  await audit(c, "licenses.create", "license", licenses.map((license) => license.id).join(","), { count: licenses.length });
  return c.json({ licenses }, 201);
});

platformAdmin.post("/licenses/:id/revoke", async (c) => {
  const id = c.req.param("id");
  const result = await c.env.DB.prepare("update cloud_licenses set status = 'revoked' where id = ?").bind(id).run();
  if (!result.meta.changes) return c.json({ error: "not-found" }, 404);
  await audit(c, "license.revoke", "license", id);
  return c.json({ ok: true });
});

for (const [action, status] of [
  ["pause", "paused"],
  ["resume", "active"],
] as const) {
  platformAdmin.post(`/households/:id/${action}`, async (c) => {
    const id = c.req.param("id");
    const result = await setHouseholdStatus(c.env, id, status);
    if (!result.meta.changes) return c.json({ error: "not-found" }, 404);
    await audit(c, `household.${action}`, "household", id);
    return c.json({ ok: true, status });
  });
}

platformAdmin.delete("/households/:id", async (c) => {
  const id = c.req.param("id");
  const input = await parse(c, deleteHouseholdInput);
  if (!input || input.confirm !== id) return c.json({ error: "confirmation-required" }, 400);
  const eligible = await c.env.DB.prepare(
    `select h.id from households h join household_plans p on p.household_id = h.id
      where h.id = ? and p.status = 'paused' and coalesce(h.last_activity_at, h.created_at) <= ?`,
  )
    .bind(id, inactiveBefore(Date.now()))
    .first();
  if (!eligible) return c.json({ error: "not-eligible" }, 409);
  try {
    await photoStorage(c.env).deletePrefix(`households/${id}/photos`);
    await householdLog(c.env, id).purge();
  } catch (error) {
    return photoStorageFailure(c, error);
  }
  const result = await c.env.DB.prepare("delete from households where id = ?").bind(id).run();
  if (!result.meta.changes) return c.json({ error: "not-found" }, 404);
  await audit(c, "household.delete", "household", id);
  return c.json({ ok: true });
});

platformAdmin.get("/feedback", async (c) => {
  const rows = await c.env.DB.prepare(
    "select id, email, category, message, status, created_at as createdAt, updated_at as updatedAt from feedback order by created_at desc limit 200",
  ).all();
  return c.json({ feedback: rows.results });
});

platformAdmin.patch("/feedback/:id", async (c) => {
  const input = await parse(c, feedbackStatusInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const id = c.req.param("id");
  const result = await c.env.DB.prepare("update feedback set status = ?, updated_at = ? where id = ?").bind(input.status, Date.now(), id).run();
  if (!result.meta.changes) return c.json({ error: "not-found" }, 404);
  await audit(c, "feedback.status", "feedback", id, { status: input.status });
  return c.json({ ok: true });
});

platformAdmin.get("/mail", async (c) => c.json(await mailOverview(c.env)));

platformAdmin.post("/mail/test", async (c) => {
  if (mailConfigState(c.env) !== "configured") return c.json({ error: "mail-not-configured" }, 503);
  if (await tooMany(c.env, "mail:operator:test", 3, 3_600_000)) return c.json({ error: "rate-limited" }, 429);
  await queueTestEmail(c.env);
  await audit(c, "mail.test", "mail", "operator");
  return c.json({ queued: true }, 202);
});

platformAdmin.post("/mail/process", async (c) => {
  if (mailConfigState(c.env) !== "configured") return c.json({ error: "mail-not-configured" }, 503);
  return c.json(await processEmails(c.env));
});

platformAdmin.post("/mail/retry", async (c) => {
  const result = await c.env.DB.prepare(
    `update email_outbox set status = 'pending', first_attempt_at = null, attempts = 0, next_attempt_at = ?
     where status = 'failed' and last_error <> 'delivery-unknown'`,
  ).bind(Date.now()).run();
  await audit(c, "mail.retry", "mail", "failed", { count: result.meta.changes });
  return c.json({ queued: result.meta.changes });
});

platformAdmin.get("/notices", async (c) => {
  await processInactivity(c.env);
  const rows = await c.env.DB.prepare(
    `select n.household_id as householdId, n.days_before_pause as daysBeforePause, n.due_at as dueAt, n.status, n.created_at as createdAt,
            group_concat(u.email) as memberEmails
       from inactivity_notices n
       join memberships m on m.household_id = n.household_id
       join "user" u on u.id = m.user_id
      group by n.household_id, n.days_before_pause, n.due_at, n.status, n.created_at
      order by case n.status when 'pending' then 0 else 1 end, n.due_at`,
  ).all();
  return c.json({ notices: rows.results });
});

platformAdmin.patch("/notices/:householdId/:days", async (c) => {
  const input = await parse(c, inactivityNoticeStatusInput);
  const days = Number(c.req.param("days"));
  if (!input || !INACTIVITY_NOTICE_DAYS.includes(days as (typeof INACTIVITY_NOTICE_DAYS)[number])) return c.json({ error: "invalid" }, 400);
  const householdId = c.req.param("householdId");
  const result = await c.env.DB.prepare("update inactivity_notices set status = ?, updated_at = ? where household_id = ? and days_before_pause = ?")
    .bind(input.status, Date.now(), householdId, days)
    .run();
  if (!result.meta.changes) return c.json({ error: "not-found" }, 404);
  await audit(c, "notice.status", "household", householdId, { days, status: input.status });
  return c.json({ ok: true });
});

// --- Lista de espera y capacidad: el operador decide cuándo entra cada casa a la nube ------------

platformAdmin.get("/waitlist", async (c) => {
  const rows = await c.env.DB.prepare(
    `select w.id, w.name, w.email, w.status, w.created_at as createdAt, w.enabled_at as enabledAt, coalesce(l.used, 0) > 0 as used
       from cloud_waitlist w left join cloud_licenses l on l.id = w.license_id
      order by w.status = 'enabled', w.created_at`,
  ).all();
  return c.json({ waitlist: rows.results });
});

/**
 * Habilitar de la lista de espera, de a tandas: un código para cada uno (sirve para una casa). Si ya
 * tenía uno sin usar, se revoca y va otro. Sale por correo si está configurado, y el código se ve una
 * sola vez acá para mandarlo por otro lado. Quien ya creó su casa no recibe otro.
 */
platformAdmin.post("/waitlist/enable", async (c) => {
  const input = await parse(c, waitlistEnableInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const rows = await c.env.DB.prepare(
    `select w.id, w.name, w.email, w.license_id as licenseId from cloud_waitlist w left join cloud_licenses l on l.id = w.license_id
      where w.id in (select value from json_each(?)) and coalesce(l.used, 0) = 0`,
  )
    .bind(JSON.stringify(input.ids))
    .all<{ id: string; name: string; email: string; licenseId: string | null }>();
  const now = Date.now();
  const enabled = await Promise.all(
    rows.results.map(async (row) => {
      const license = { id: crypto.randomUUID(), code: newLicenseCode() };
      const email = accessEmailStatement(c.env, { id: `access/${row.id}/${license.id}`, name: row.name, email: row.email, code: license.code });
      const statements = [
        c.env.DB.prepare(
          "insert into cloud_licenses (id, code_hash, plan, max_households, expires_at, source, external_id, note, created_at) values (?, ?, 'beta', 1, null, 'waitlist', null, ?, ?)",
        ).bind(license.id, await sha256(normalizeLicenseCode(license.code)), `Lista de espera: ${row.name}`.slice(0, 120), now),
        c.env.DB.prepare("update cloud_waitlist set status = 'enabled', license_id = ?, enabled_at = ? where id = ?").bind(license.id, now, row.id),
        // El código anterior (si lo había) deja de servir, y su correo pendiente no sale.
        c.env.DB.prepare("update cloud_licenses set status = 'revoked' where id = ? and used = 0").bind(row.licenseId),
        c.env.DB.prepare("update email_outbox set status = 'cancelled', body = '' where id like ? and status in ('pending', 'failed')").bind(`access/${row.id}/%`),
        ...(email ? [email] : []),
      ];
      return { row, license, statements, emailed: Boolean(email) };
    }),
  );
  if (enabled.length) await c.env.DB.batch(enabled.flatMap((entry) => entry.statements));
  await audit(c, "waitlist.enable", "waitlist", enabled.map((entry) => entry.row.id).join(","), { count: enabled.length });
  // Los correos salen ahora, sin esperar la próxima vuelta programada.
  if (enabled.some((entry) => entry.emailed)) c.executionCtx.waitUntil(processEmails(c.env).catch((error) => console.error("[mail] failed", error)));
  return c.json({ enabled: enabled.map(({ row, license, emailed }) => ({ id: row.id, name: row.name, email: row.email, code: license.code, emailed })) });
});

/** Borrar de la lista de espera (también a pedido de la persona). Un código ya entregado sigue en Licencias. */
platformAdmin.delete("/waitlist/:id", async (c) => {
  const id = c.req.param("id");
  const result = await c.env.DB.prepare("delete from cloud_waitlist where id = ?").bind(id).run();
  if (!result.meta.changes) return c.json({ error: "not-found" }, 404);
  await audit(c, "waitlist.delete", "waitlist", id);
  return c.json({ ok: true });
});

/** Para decidir si habilitar más casas o contratar: casas, lista de espera, fotos y quién llegó a su tope. */
platformAdmin.get("/capacity", async (c) => {
  const [households, waiting, photos, defaults, hits, overrides] = await Promise.all([
    c.env.DB.prepare(
      `select count(*) as total, coalesce(sum(case when coalesce(p.status, 'active') = 'active' then 1 else 0 end), 0) as active
         from households h left join household_plans p on p.household_id = h.id`,
    ).first<{ total: number; active: number }>(),
    c.env.DB.prepare("select count(*) as count from cloud_waitlist where status = 'waiting'").first<{ count: number }>(),
    c.env.DB.prepare("select coalesce(sum(bytes), 0) as bytes from photo_objects").first<{ bytes: number }>(),
    defaultQuotas(c.env.DB),
    c.env.DB.prepare("select household_id as householdId, kind, at from quota_hits where at > ? order by at desc limit 100").bind(Date.now() - 14 * DAY).all(),
    c.env.DB.prepare("select household_id as householdId, ops_per_day as opsPerDay, log_bytes as logBytes, photo_bytes as photoBytes from household_quotas").all(),
  ]);
  return c.json({
    enforced: quotasOn(c.env),
    households: { total: households?.total ?? 0, active: households?.active ?? 0 },
    waiting: waiting?.count ?? 0,
    photos: { bytes: photos?.bytes ?? 0, freeBytes: PHOTO_FREE_BYTES },
    defaults,
    codeDefaults: HOUSEHOLD_QUOTAS,
    hits: hits.results,
    overrides: overrides.results,
  });
});

/** Los topes de todas las casas. Subirlos puede pasar la capa gratuita: es una decisión del operador. */
platformAdmin.put("/quotas", async (c) => {
  const input = await parse(c, quotaDefaultsInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  await c.env.DB.prepare(
    `insert into quota_defaults (id, ops_per_day, log_bytes, photo_bytes, updated_at) values (1, ?, ?, ?, ?)
     on conflict (id) do update set ops_per_day = excluded.ops_per_day, log_bytes = excluded.log_bytes, photo_bytes = excluded.photo_bytes, updated_at = excluded.updated_at`,
  )
    .bind(input.opsPerDay, input.logBytes, input.photoBytes, Date.now())
    .run();
  await audit(c, "quotas.defaults", "quotas", "defaults", input);
  return c.json({ ok: true });
});

/** Cuánto usa una casa y qué topes tiene. No ve contenido: cuenta operaciones y bytes cifrados. */
platformAdmin.get("/households/:id/usage", async (c) => {
  const id = c.req.param("id");
  if (!(await c.env.DB.prepare("select 1 from households where id = ?").bind(id).first())) return c.json({ error: "not-found" }, 404);
  const [log, photos, limits, override] = await Promise.all([
    householdLog(c.env, id).stats(),
    c.env.DB.prepare("select coalesce(sum(bytes), 0) as bytes from photo_objects where household_id = ?").bind(id).first<{ bytes: number }>(),
    householdQuotas(c.env.DB, id),
    c.env.DB.prepare("select ops_per_day as opsPerDay, log_bytes as logBytes, photo_bytes as photoBytes from household_quotas where household_id = ?").bind(id).first(),
  ]);
  return c.json({ usage: { opsToday: log.opsToday, logBytes: log.logBytes, photoBytes: photos?.bytes ?? 0 }, limits, override: override ?? null });
});

/** El tope propio de una casa (cada valor en `null` vuelve al de todas). */
platformAdmin.put("/households/:id/quotas", async (c) => {
  const id = c.req.param("id");
  const input = await parse(c, householdQuotaInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (!(await c.env.DB.prepare("select 1 from households where id = ?").bind(id).first())) return c.json({ error: "not-found" }, 404);
  if (input.opsPerDay === null && input.logBytes === null && input.photoBytes === null) {
    await c.env.DB.prepare("delete from household_quotas where household_id = ?").bind(id).run();
  } else {
    await c.env.DB.prepare(
      `insert into household_quotas (household_id, ops_per_day, log_bytes, photo_bytes, updated_at) values (?, ?, ?, ?, ?)
       on conflict (household_id) do update set ops_per_day = excluded.ops_per_day, log_bytes = excluded.log_bytes, photo_bytes = excluded.photo_bytes, updated_at = excluded.updated_at`,
    )
      .bind(id, input.opsPerDay, input.logBytes, input.photoBytes, Date.now())
      .run();
  }
  await audit(c, "household.quotas", "household", id, input);
  return c.json({ ok: true });
});

admin.get("/metrics", async (c) => {
  const cutoff = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
  const rows = await c.env.DB.prepare(
    "select day, metric, count from daily_metrics where day >= ? order by day desc, metric asc",
  )
    .bind(cutoff)
    .all<{ day: string; metric: string; count: number }>();
  return c.json({ metrics: rows.results });
});

admin.route("/platform", platformAdmin);
app.route("/admin", admin);

app.notFound((c) => c.json({ error: "not-found" }, 404));
app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "server-error" }, 500);
});

/**
 * Avisos en tiempo real (WebSocket). Va por fuera de Hono: la respuesta 101 lleva el socket y no
 * se puede copiar para sumarle encabezados. Los navegadores mandan la cookie también a sockets de
 * otros sitios, así que el origen se exige acá igual que en lo que cambia datos.
 */
async function live(request: Request, env: Env, householdId: string) {
  const json = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(env).includes(origin)) return json("forbidden-origin", 403);
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json("expected-websocket", 426);
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session) return json("unauthorized", 401);
  if (!uuid.safeParse(householdId).success || !(await membership(env, householdId, session.user.id))) return json("not-found", 404);
  // Sobrescribir también encabezados que pudiera enviar un cliente: solo vale la sesión verificada.
  const headers = new Headers(request.headers);
  headers.set("X-Refugiar-Household", householdId);
  headers.set("X-Refugiar-User", session.user.id);
  headers.set("X-Refugiar-Session", session.session.id);
  return householdLog(env, householdId).fetch(new Request(request, { headers }));
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return operatorPage(request, env.ASSETS, env.APP_ORIGIN);
    const socket = url.pathname.match(/^\/api\/households\/([^/]+)\/live$/);
    if (socket) return live(request, env, socket[1]);
    // `run_worker_first` incluye /admin y /api/*; lo demás son archivos de la app.
    if (url.pathname.startsWith("/api/")) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        if (controller.cron === "17 4 * * *") {
          await env.DB.batch([
            env.DB.prepare("delete from content_shares where id in (select id from content_shares where expires_at<=? limit 200)").bind(Date.now()),
            env.DB.prepare("delete from project_shares where id in (select id from project_shares where expires_at<=? limit 200)").bind(Date.now()),
            env.DB.prepare("delete from attempts where key like 'share-%' and window_start<?").bind(Date.now() - 2 * 86400000),
          ]);
          const result = await processInactivity(env);
          console.log(`[inactivity] notices=${result.noticesQueued} paused=${result.householdsPaused}`);
        }
        await processEmails(env);
      })().catch((error) => console.error("[scheduled] failed", error)),
    );
  },
} satisfies ExportedHandler<Env>;
