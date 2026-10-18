/**
 * Recorrido completo de la API contra un Worker local (`npm run dev:api`, con D1 local):
 * Ana crea su cuenta y su casa, invita a Flor por link, Flor se une y abre las claves de la casa.
 * Además, lo que NO tiene que poder pasar. Uso: `node --import ./scripts/test-hooks.mjs --test server/test/api.e2e.ts`
 */
import assert from "node:assert/strict";
import { createOTP } from "@better-auth/utils/otp";
import { operatorTotp } from "../src/operator-auth";
import { softwareAuthenticator } from "./webauthn-fixture";
import { test } from "node:test";
import WebSocket from "ws";
import {
  createDeviceIdentity,
  createIdentity,
  derivePasswordKeys,
  envelopeContext,
  importScopeKey,
  inviteSecrets,
  newRecoveryKit,
  newScopeKey,
  open,
  openEnvelope,
  openText,
  recoverIdentity,
  recoveryProof,
  rewrapIdentity,
  seal,
  sealEnvelope,
  sha256,
  sign,
  signWithDevice,
  toB64u,
  unlockIdentity,
  verify,
  wrapForPasskey,
  type Identity,
  type Scope,
} from "../../src/lib/crypto";
import { opContext, opSigningData, type StoredOp, type WireOp } from "../../src/lib/sync/protocol";
import { deviceSignInData } from "../../src/lib/cloud/device-protocol";

const API = process.env.API ?? "http://127.0.0.1:8787";
const ORIGIN = "http://localhost:3000";
const FAST = 1_000;

class Client {
  cookies = new Map<string, string>();
  /** Otra IP para el límite de altas de Better Auth (tres por minuto por IP). */
  ip?: string;
  constructor(ip?: string) {
    this.ip = ip;
  }
  async call(method: string, path: string, body?: unknown, { origin = ORIGIN }: { origin?: string | null } = {}) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (origin) headers.Origin = origin;
    if (this.ip) headers["cf-connecting-ip"] = this.ip;
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    // getSetCookie existe en Node (donde corre este test), no en los tipos del Worker.
    for (const cookie of (response.headers as unknown as { getSetCookie(): string[] }).getSetCookie()) {
      const [pair] = cookie.split(";");
      const [name, ...rest] = pair.split("=");
      this.cookies.set(name.trim(), rest.join("="));
    }
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }
}

/** Nube cerrada: cada alta lleva un código de acceso vigente (no se consume) o una invitación. */
let accessCode: Promise<string> | undefined;
function signUpCode() {
  accessCode ??= adminCall("POST", "/platform/licenses", { count: 1, maxHouseholds: 10, note: `altas ${unique}` }).then((issued) => issued.body.licenses[0].code as string);
  return accessCode;
}

async function signUp(name: string, email: string, password: string, ip?: string, access?: unknown) {
  const client = new Client(ip);
  const keys = await derivePasswordKeys(email, password, FAST);
  const signUp = await client.call("POST", "/api/auth/sign-up/email", { name, email, password: keys.authKey, access: access ?? { code: await signUpCode() } });
  assert.equal(signUp.status, 200, JSON.stringify(signUp.body));
  const { identity, upload, recoveryCode } = await createIdentity(keys.encKey);
  assert.equal((await client.call("POST", "/api/keys", upload)).status, 201);
  const me = await client.call("GET", "/api/me");
  return { client, keys, identity, upload, recoveryCode, userId: me.body.user.id as string };
}

const unique = Date.now().toString(36);
const anaEmail = `admin+${unique}@casa.test`;

let adminSession = "";
function adminToken() { return "ab".repeat(32); }
async function adminCall(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown, token = adminToken()) {
  if (!adminSession && token === adminToken()) {
    const login = await fetch(API + "/api/admin/auth/login", { method: "POST", headers: { Origin: API, "Content-Type": "application/json", "X-Refugiar-Operator": "browser" }, body: JSON.stringify({ key: token, code: await operatorTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", Math.floor(Date.now() / 30000)) }) });
    assert.equal(login.status, 200);
    adminSession = login.headers.get("set-cookie")!.split(";")[0];
  }
  const response = await fetch(`${API}/api/admin${path}`, {
    method,
    headers: { Cookie: token === adminToken() ? adminSession : "", Origin: API, "X-Refugiar-Operator": "browser", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: JSON.parse(await response.text() || "null") };
}

test("cuenta, casa, invitación y unión, de punta a punta y cifrado", async (t) => {
  const anonymous = new Client();
  assert.equal((await anonymous.call("POST", "/api/auth/sign-in/email", { oversized: "x".repeat(17 * 1024) })).status, 413);
  assert.equal((await anonymous.call("POST", "/api/feedback", { message: "x".repeat(9 * 1024) })).status, 413);
  // Ana: cuenta + casa con sus tres claves de nivel.
  const ana = await signUp("Ana", anaEmail, "una frase larga para ana");
  // Publishing a bounded copy is independent of creating or syncing a household.
  // Extend this API traversal with the new capabilities; no separate suite or browser.
  const sharedId = crypto.randomUUID(), sharedItem = crypto.randomUUID();
  const sharedSecrets = await inviteSecrets(), sharedWriter = await inviteSecrets();
  const sharedBody = await seal(sharedSecrets.wrapKey, JSON.stringify({ version: 1, kind: "shopping-list", name: "Lista aislada" }), `content-share/v1/${sharedId}`);
  const publication = { id: sharedId, sourceKey: "shopping-list:local-list", sources: ["shopping-list:local-list"], kind: "shopping-list", mode: "live-check", days: 7, tokenHash: await sha256(sharedSecrets.authToken), writeHash: await sha256(sharedWriter.authToken), body: sharedBody, itemIds: [sharedItem] };
  assert.equal((await anonymous.call("POST", "/api/shares", publication)).status, 401);
  assert.equal((await ana.client.call("POST", "/api/shares", publication)).status, 201);
  assert.equal((await ana.client.call("POST", "/api/shares", publication)).status, 200); // lost-response retry
  assert.equal((await anonymous.call("GET", `/api/shares/${sharedId}`)).status, 401);
  assert.equal((await anonymous.call("POST", `/api/shared/${sharedId}`, { token: sharedWriter.authToken })).status, 404);
  const sharedRead = await anonymous.call("POST", `/api/shared/${sharedId}`, { token: sharedSecrets.authToken });
  assert.equal(sharedRead.status, 200);
  assert.equal(sharedRead.body.body, sharedBody);
  assert.equal(sharedRead.body.owner_id, undefined);
  assert.equal(sharedRead.body.sourceKey, undefined);
  const check = { token: sharedSecrets.authToken, writeToken: sharedSecrets.authToken, itemId: sharedItem, revision: 0, checked: true };
  assert.equal((await anonymous.call("POST", `/api/shared/${sharedId}/check`, check)).status, 403);
  check.writeToken = sharedWriter.authToken;
  const simultaneous = await Promise.all([anonymous.call("POST", `/api/shared/${sharedId}/check`, check), anonymous.call("POST", `/api/shared/${sharedId}/check`, check)]);
  assert.deepEqual(simultaneous.map(result => result.status).sort(), [200, 409]);
  assert.equal((await ana.client.call("PATCH", `/api/shares/${sharedId}`, { body: sharedBody, version: 0, itemIds: [sharedItem], receivedIds: [] })).status, 409);
  assert.equal((await ana.client.call("PATCH", `/api/shares/${sharedId}`, { body: sharedBody, version: 1, itemIds: [sharedItem], receivedIds: [sharedItem] })).status, 200);
  assert.equal((await anonymous.call("POST", `/api/shared/${sharedId}/check`, { ...check, revision: 2, checked: false })).status, 409);
  assert.equal((await ana.client.call("GET", "/api/shares")).body.links.length, 1);
  assert.equal((await ana.client.call("POST", "/api/shares", { ...publication, id: crypto.randomUUID(), body: "a".repeat(160001) })).status, 400);
  assert.equal((await ana.client.call("DELETE", "/api/shares/source/shopping-list%3Alocal-list")).status, 200);
  assert.equal((await anonymous.call("POST", `/api/shared/${sharedId}`, { token: sharedSecrets.authToken })).status, 404);
  assert.equal((await ana.client.call("POST", "/api/shares", { ...publication, id: crypto.randomUUID() })).status, 409);
  // Old encrypted links retain their original body and authorization protocol.
  const legacyId = crypto.randomUUID();
  const legacyBody = await seal(sharedSecrets.wrapKey, "legacy", `project-share/v1/${legacyId}`);
  assert.equal((await ana.client.call("POST", "/api/project-shares", { id: legacyId, projectId: "old-project", recipient: "Prueba", days: 7, tokenHash: publication.tokenHash, body: legacyBody })).status, 201);
  assert.equal((await anonymous.call("POST", `/api/shared-project/${legacyId}`, { token: sharedSecrets.authToken })).body.body, legacyBody);
  assert.equal((await ana.client.call("GET", "/api/shares")).body.links[0].legacy, 1);
  assert.equal((await ana.client.call("DELETE", `/api/shares/${legacyId}`)).status, 200);
  const householdId = crypto.randomUUID();
  const raw: Record<Scope, Uint8Array> = { family: newScopeKey(), adults: newScopeKey(), private: newScopeKey() };
  const familyKey = await importScopeKey(raw.family);
  const encryptedName = await seal(familyKey, "Casa Paredez", `household-name|${householdId}`);
  const envelopes = await Promise.all(
    (Object.keys(raw) as Scope[]).map(async (scope) => ({
      scope,
      version: 1,
      envelope: await sealEnvelope(raw[scope], ana.upload.encPublicKey, envelopeContext(householdId, scope, 1, ana.userId)),
    })),
  );
  // --- Licencias: la nube es opcional y crear una casa pide una (la emite Juan, o mañana el cobro) ---
  assert.equal((await adminCall("GET", "/platform/licenses", undefined, "")).status, 404);
  assert.equal((await adminCall("GET", "/platform/licenses", undefined, "x".repeat(48))).status, 404);
  const issued = await adminCall("POST", "/platform/licenses", { count: 2, note: `prueba ${unique}` });
  assert.equal(issued.status, 201, JSON.stringify(issued.body));
  const [license, spare] = issued.body.licenses as { id: string; code: string }[];
  assert.match(license.code, /^OD(-[A-Z2-9]{4}){4}$/);
  // Se valida antes de crear la cuenta, sin consumirla; con guiones o sin, en minúscula o mayúscula.
  assert.equal((await new Client().call("POST", "/api/licenses/check", { code: license.code.toLowerCase().replace(/-/g, " ") })).body.valid, true);
  assert.equal((await new Client().call("POST", "/api/licenses/check", { code: "OD-AAAA-AAAA-AAAA-AAAA" })).body.valid, false);
  const createWith = (accessCode?: string) => ana.client.call("POST", "/api/households", { id: householdId, encryptedName, envelopes, accessCode });
  assert.equal((await createWith()).status, 403);
  assert.equal((await createWith("OD-AAAA-AAAA-AAAA-AAAA")).status, 403);
  // Una licencia revocada no sirve.
  assert.equal((await adminCall("POST", `/platform/licenses/${spare.id}/revoke`)).status, 200);
  assert.equal((await createWith(spare.code)).status, 403);
  const created = await createWith(license.code);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  // Usada una vez (una casa por licencia): ya no sirve para otra.
  assert.equal((await new Client().call("POST", "/api/licenses/check", { code: license.code })).body.valid, false);
  const second = await ana.client.call("POST", "/api/households", { id: crypto.randomUUID(), encryptedName, envelopes, accessCode: license.code });
  assert.equal(second.status, 403);

  // Ana se vuelve a abrir todo desde el servidor (otro dispositivo): contraseña → identidad → sobres.
  const me = await ana.client.call("GET", "/api/me");
  assert.equal(me.body.households[0].role, "admin");
  assert.equal(me.body.households[0].plan, "beta");
  assert.equal(me.body.households[0].planStatus, "active");
  const again = await unlockIdentity(me.body.keys, ana.keys.encKey);
  const familyEnvelope = me.body.households[0].envelopes.find((entry: { scope: string }) => entry.scope === "family");
  const opened = await openEnvelope(familyEnvelope.envelope, again, envelopeContext(householdId, "family", 1, ana.userId));
  assert.equal(await openText(opened.key, me.body.households[0].encryptedName, `household-name|${householdId}`), "Casa Paredez");

  // Invitación para Flor (adulta): las claves viajan cifradas con la clave del link.
  const invite = await inviteSecrets();
  const inviteId = crypto.randomUUID();
  const wrappedKeys = JSON.stringify({
    family: { version: 1, key: await seal(invite.wrapKey, raw.family, `invite|${inviteId}|family`) },
    adults: { version: 1, key: await seal(invite.wrapKey, raw.adults, `invite|${inviteId}|adults`) },
  });
  const createdInvite = await ana.client.call("POST", `/api/households/${householdId}/invites`, { id: inviteId, role: "adult", tokenHash: await sha256(invite.authToken), wrappedKeys });
  assert.equal(createdInvite.status, 201, JSON.stringify(createdInvite.body));

  // Nube cerrada: sin código de acceso ni invitación no se crea una cuenta.
  const outsider = await derivePasswordKeys(`afuera-${unique}@casa.test`, "una frase larga de alguien de afuera", FAST);
  // Cada intento desde otra IP: el límite de altas de Better Auth (tres por minuto) corre antes.
  let outsiderIp = 40;
  const outsiderSignUp = (access?: unknown) =>
    new Client(`198.51.100.${outsiderIp++}`).call("POST", "/api/auth/sign-up/email", { name: "Afuera", email: `afuera-${unique}@casa.test`, password: outsider.authKey, access });
  assert.equal((await outsiderSignUp()).status, 403);
  assert.equal((await outsiderSignUp({ code: "OD-AAAA-AAAA-AAAA-AAAA" })).status, 403);
  assert.equal((await outsiderSignUp({ invite: { id: inviteId, authToken: toB64u(crypto.getRandomValues(new Uint8Array(32))) } })).status, 403);

  // Flor abre el link (sin cuenta todavía): crea su cuenta con la invitación y ve quién la invita y el nombre de la casa.
  const joinWith = await inviteSecrets(invite.secret);
  const flor = await signUp("Flor", `flor-${unique}@casa.test`, "otra frase larga para flor", undefined, { invite: { id: inviteId, authToken: joinWith.authToken } });
  const preview = await new Client().call("POST", `/api/invites/${inviteId}/preview`, { authToken: joinWith.authToken });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.inviterName, "Ana");
  const carried = JSON.parse(preview.body.wrappedKeys);
  const florFamily = await open(joinWith.wrapKey, carried.family.key, `invite|${inviteId}|family`);
  const florAdults = await open(joinWith.wrapKey, carried.adults.key, `invite|${inviteId}|adults`);
  assert.equal(await openText(await importScopeKey(florFamily), encryptedName, `household-name|${householdId}`), "Casa Paredez");

  // Flor se une: re-ensobra las claves para sí misma y agrega su clave privada.
  const florEnvelopes = [
    { scope: "family", version: 1, envelope: await sealEnvelope(florFamily, flor.upload.encPublicKey, envelopeContext(householdId, "family", 1, flor.userId)) },
    { scope: "adults", version: 1, envelope: await sealEnvelope(florAdults, flor.upload.encPublicKey, envelopeContext(householdId, "adults", 1, flor.userId)) },
    { scope: "private", version: 1, envelope: await sealEnvelope(newScopeKey(), flor.upload.encPublicKey, envelopeContext(householdId, "private", 1, flor.userId)) },
  ];
  const accepted = await flor.client.call("POST", `/api/invites/${inviteId}/accept`, { authToken: joinWith.authToken, envelopes: florEnvelopes });
  assert.equal(accepted.status, 202, JSON.stringify(accepted.body));
  assert.equal(accepted.body.role, "adult");
  assert.equal(accepted.body.pending, true);

  // Todavía no es de la casa: espera que la admin la apruebe.
  assert.equal((await flor.client.call("GET", `/api/households/${householdId}/members`)).status, 404);
  assert.equal((await flor.client.call("POST", `/api/invites/${inviteId}/accept`, { authToken: joinWith.authToken, envelopes: florEnvelopes })).status, 410);
  assert.equal((await flor.client.call("GET", `/api/households/${householdId}/join-requests`)).status, 403);
  const requests = await ana.client.call("GET", `/api/households/${householdId}/join-requests`);
  assert.equal(requests.status, 200, JSON.stringify(requests.body));
  assert.deepEqual(requests.body.requests.map((request: { id: string; name: string; role: string }) => `${request.id}:${request.name}:${request.role}`), [`${inviteId}:Flor:adult`]);
  const approved = await ana.client.call("POST", `/api/households/${householdId}/join-requests/${inviteId}/approve`);
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal((await ana.client.call("POST", `/api/households/${householdId}/join-requests/${inviteId}/approve`)).status, 404);

  const members = await ana.client.call("GET", `/api/households/${householdId}/members`);
  assert.deepEqual(members.body.members.map((member: { name: string; role: string }) => `${member.name}:${member.role}`), ["Ana:admin", "Flor:adult"]);

  // --- Lo que no tiene que pasar ---
  // La misma invitación no sirve dos veces: ni para entrar ni para crear otra cuenta.
  const reuse = await ana.client.call("POST", `/api/invites/${inviteId}/accept`, { authToken: joinWith.authToken, envelopes: florEnvelopes });
  assert.equal(reuse.status, 410);
  assert.equal((await outsiderSignUp({ invite: { id: inviteId, authToken: joinWith.authToken } })).status, 403);
  // Solo un admin entrega claves, en la versión vigente, y nunca pisa un sobre que ya existe.
  const handOver = (who: { client: Client }, version: number) =>
    who.client.call("POST", `/api/households/${householdId}/envelopes`, { recipientUserId: ana.userId, envelopes: [{ scope: "family", version, envelope: florEnvelopes[0].envelope }] });
  assert.equal((await handOver(flor, 1)).status, 403);
  assert.equal((await handOver(ana, 2)).status, 409);
  assert.equal((await handOver(ana, 1)).status, 200);
  const anaFamilyEnvelope = (await ana.client.call("GET", "/api/me")).body.households[0].envelopes.find((entry: { scope: string }) => entry.scope === "family");
  assert.equal(anaFamilyEnvelope.envelope, familyEnvelope.envelope);
  // Sin el secreto del link, la invitación "no existe".
  assert.equal((await new Client().call("POST", `/api/invites/${inviteId}/preview`, { authToken: toB64u(crypto.getRandomValues(new Uint8Array(32))) })).status, 404);
  // Flor no es admin: no puede invitar.
  assert.equal((await flor.client.call("POST", `/api/households/${householdId}/invites`, { id: crypto.randomUUID(), role: "kid", tokenHash: await sha256("x".repeat(43)), wrappedKeys })).status, 403);
  // Un chico no puede recibir la clave de "Adultos".
  const kidInvite = await inviteSecrets();
  const kidInviteId = crypto.randomUUID();
  await ana.client.call("POST", `/api/households/${householdId}/invites`, { id: kidInviteId, role: "kid", tokenHash: await sha256(kidInvite.authToken), wrappedKeys });
  const kid = await signUp("Tomi", `tomi-${unique}@casa.test`, "frase del chico de la casa");
  const kidTry = await kid.client.call("POST", `/api/invites/${kidInviteId}/accept`, {
    authToken: kidInvite.authToken,
    envelopes: [
      { scope: "family", version: 1, envelope: await sealEnvelope(raw.family, kid.upload.encPublicKey, envelopeContext(householdId, "family", 1, kid.userId)) },
      { scope: "adults", version: 1, envelope: await sealEnvelope(raw.adults, kid.upload.encPublicKey, envelopeContext(householdId, "adults", 1, kid.userId)) },
    ],
  });
  assert.equal(kidTry.status, 400);
  // Quien no es de la casa no ve sus miembros.
  assert.equal((await kid.client.call("GET", `/api/households/${householdId}/members`)).status, 404);
  // Sin Origin (otro sitio, un script): rechazado.
  assert.equal((await ana.client.call("POST", `/api/households/${householdId}/invites`, {}, { origin: null })).status, 403);
  assert.equal((await ana.client.call("POST", `/api/households/${householdId}/invites`, {}, { origin: "https://malicioso.example" })).status, 403);
  // Una contraseña humana cruda (no derivada) no se acepta.
  const raw1 = await new Client().call("POST", "/api/auth/sign-up/email", { name: "X", email: `x-${unique}@casa.test`, password: "123456789", access: { code: await signUpCode() } });
  assert.notEqual(raw1.status, 200);
  // Sin sesión, nada: /me responde que no hay nadie y lo demás exige sesión.
  assert.equal((await new Client().call("GET", "/api/me")).body.user, null);
  assert.equal((await new Client().call("GET", `/api/households/${householdId}/members`)).status, 401);

  // --- Sincronización: operaciones cifradas y firmadas ---
  const anaFamily = familyKey;
  const anaAdults = await importScopeKey(raw.adults);
  const anaPrivate = await importScopeKey(raw.private);
  const op = async (who: { identity: Identity; userId: string }, scope: Scope, key: CryptoKey, payload: unknown, overrides: Partial<WireOp> = {}) => {
    const base = { id: crypto.randomUUID(), scope, keyVersion: 1, ...overrides };
    const body = overrides.body ?? (await seal(key, JSON.stringify(payload), opContext(householdId, base, who.userId)));
    const unsigned = { ...base, body, sig: "" };
    return { ...unsigned, sig: overrides.sig ?? (await sign(who.identity, opSigningData(householdId, unsigned, who.userId))) };
  };
  const push = (who: { client: Client }, ops: WireOp[]) => who.client.call("POST", `/api/households/${householdId}/ops`, { ops });
  const pull = (who: { client: Client }, since = 0) => who.client.call("GET", `/api/households/${householdId}/ops?since=${since}`);

  const leche = await op(ana, "family", anaFamily, { changes: [{ t: "inventory", id: "leche", k: "put", f: { name: "Leche" } }] });
  const first = await push(ana, [leche]);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  // Reintentar lo mismo (se cortó la conexión antes de la respuesta) no duplica: mismo número.
  assert.deepEqual((await push(ana, [leche])).body.acks, first.body.acks);
  const regalo = await op(ana, "adults", anaAdults, { changes: [{ t: "shoppingList", id: "regalo", k: "put", f: { name: "Regalo de Tomi" } }] });
  const diario = await op(ana, "private", anaPrivate, { changes: [{ t: "events", id: "diario", k: "put", f: { title: "Solo mío" } }] });
  assert.equal((await push(ana, [regalo, diario])).status, 200);

  // Flor (adulta) baja Familia y Adultos, no lo privado de Ana. Abre y verifica cada operación.
  const florPull = await pull(flor);
  assert.equal(florPull.status, 200);
  assert.deepEqual(florPull.body.ops.map((stored: StoredOp) => stored.id), [leche.id, regalo.id]);
  const stored: StoredOp = florPull.body.ops[0];
  assert.equal(stored.author, ana.userId);
  assert.ok(await verify(ana.upload.signPublicKey, opSigningData(householdId, stored, stored.author), stored.sig));
  assert.deepEqual(JSON.parse(await openText(await importScopeKey(florFamily), stored.body, opContext(householdId, stored, stored.author))).changes[0].f, { name: "Leche" });
  assert.equal(florPull.body.next, florPull.body.head);
  // Pedir desde el último número no trae nada nuevo.
  assert.equal((await pull(flor, florPull.body.next)).body.ops.length, 0);

  // Un chico de verdad (Familia + su Privado) baja solo Familia y no puede escribir en Adultos.
  const kidInvite2 = await inviteSecrets();
  const kidInvite2Id = crypto.randomUUID();
  await ana.client.call("POST", `/api/households/${householdId}/invites`, { id: kidInvite2Id, role: "kid", tokenHash: await sha256(kidInvite2.authToken), wrappedKeys });
  const kidJoin = await kid.client.call("POST", `/api/invites/${kidInvite2Id}/accept`, {
    authToken: kidInvite2.authToken,
    envelopes: [
      { scope: "family", version: 1, envelope: await sealEnvelope(raw.family, kid.upload.encPublicKey, envelopeContext(householdId, "family", 1, kid.userId)) },
      { scope: "private", version: 1, envelope: await sealEnvelope(newScopeKey(), kid.upload.encPublicKey, envelopeContext(householdId, "private", 1, kid.userId)) },
    ],
  });
  assert.equal(kidJoin.status, 202, JSON.stringify(kidJoin.body));
  assert.equal((await ana.client.call("POST", `/api/households/${householdId}/join-requests/${kidInvite2Id}/approve`)).status, 200);
  assert.deepEqual((await pull(kid)).body.ops.map((stored: StoredOp) => stored.id), [leche.id]);
  assert.equal((await push(kid, [await op(kid, "adults", anaAdults, { changes: [] })])).status, 403);

  // Firmas: una operación firmada por otra persona, o modificada después de firmar, no entra.
  const forged = await op(flor, "family", anaFamily, { changes: [] });
  assert.equal((await push(ana, [forged])).status, 400);
  const tampered = await op(ana, "family", anaFamily, { changes: [] });
  assert.equal((await push(ana, [{ ...tampered, body: leche.body }])).status, 400);
  // El servidor tampoco puede cambiar de nivel una operación: deja de abrir en el dispositivo.
  const moved = { ...stored, scope: "adults" as const };
  await assert.rejects(openText(await importScopeKey(florFamily), moved.body, opContext(householdId, moved, moved.author)));
  // Versión de clave vieja o futura: rechazada.
  assert.equal((await push(ana, [await op(ana, "family", anaFamily, { changes: [] }, { keyVersion: 2 })])).status, 409);
  // Reusar el id de una operación ajena: conflicto.
  assert.equal((await push(flor, [await op(flor, "family", anaFamily, { changes: [] }, { id: leche.id })])).status, 409);
  // Sin Origin, sin sesión o sin ser de la casa: nada.
  assert.equal((await ana.client.call("POST", `/api/households/${householdId}/ops`, { ops: [leche] }, { origin: null })).status, 403);
  assert.equal((await new Client().call("GET", `/api/households/${householdId}/ops`)).status, 401);

  // Avisos en tiempo real: sin Origin conocido, rechazado; con sesión y Origin, llega el último número.
  const live = (origin: string, client: Client | null) =>
    new Promise<number | "rejected">((resolve) => {
      const headers: Record<string, string> = { Origin: origin };
      if (client) headers.Cookie = [...client.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
      // Cliente Node explícito: permite probar cookies y Origin del handshake del navegador.
      const socket = new WebSocket(`${API.replace(/^http/, "ws")}/api/households/${householdId}/live`, { headers });
      socket.onmessage = (event) => {
        resolve(JSON.parse(String(event.data)).seq);
        socket.close();
      };
      socket.onerror = () => resolve("rejected");
    });
  assert.equal(await live("https://malicioso.example", flor.client), "rejected");
  assert.equal(await live(ORIGIN, null), "rejected");
  // Lo rechazado nunca llegó al registro: siguen siendo las tres operaciones de Ana.
  assert.equal(await live(ORIGIN, flor.client), florPull.body.head);
  async function persistentLive(client: Client, extraHeaders: Record<string, string> = {}) {
    const headers = { Origin: ORIGIN, Cookie: [...client.cookies].map(([name, value]) => `${name}=${value}`).join("; "), ...extraHeaders };
    const socket = new WebSocket(`${API.replace(/^http/, "ws")}/api/households/${householdId}/live`, { headers });
    t.after(() => socket.close());
    const received: number[] = [];
    const closed = new Promise<number>((resolve) => { socket.onclose = (event) => resolve(event.code); });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { socket.close(); reject(new Error("live handshake timed out")); }, 10_000);
      socket.onmessage = (event) => {
        received.push(JSON.parse(String(event.data)).seq);
        clearTimeout(timeout);
        resolve();
      };
      socket.onerror = () => { clearTimeout(timeout); reject(new Error("live handshake failed")); };
    });
    return {
      socket, received,
      closed: (label: string) => new Promise<number>((resolve, reject) => {
        // El proxy local puede demorar en completar el cierre TCP; se exige el código de
        // autorización y se verifica aparte que no se haya recibido ningún aviso posterior.
        const timeout = setTimeout(() => reject(new Error(`${label} socket remained open; messages=${received.length}, state=${socket.readyState}`)), 35_000);
        void closed.then((code) => { clearTimeout(timeout); resolve(code); });
      }),
    };
  }

  // --- Recuperar con el kit (sin sesión, sin email) ---
  const recovery = (path: string, body: unknown) => new Client().call("POST", `/api/recovery/${path}`, body);
  const otherKit = (await createIdentity((await derivePasswordKeys("x@x.test", "x", FAST)).encKey)).recoveryCode;
  // Kit equivocado o email sin cuenta: la misma respuesta (no revela qué emails existen).
  assert.equal((await recovery("start", { email: anaEmail, recoveryAuth: await recoveryProof(otherKit) })).status, 403);
  assert.equal((await recovery("start", { email: `nadie-${unique}@casa.test`, recoveryAuth: await recoveryProof(ana.recoveryCode) })).status, 403);
  const started = await recovery("start", { email: anaEmail.toUpperCase(), recoveryAuth: await recoveryProof(ana.recoveryCode) });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  assert.equal(started.body.recoveryPrivateKeys, ana.upload.recoveryPrivateKeys);
  const anaNew = await derivePasswordKeys(anaEmail, "la contraseña nueva de ana", FAST);
  const recovered = await recoverIdentity(started.body, ana.recoveryCode, anaNew.encKey);
  const completed = await recovery("complete", {
    email: anaEmail,
    recoveryAuth: await recoveryProof(ana.recoveryCode),
    newPassword: anaNew.authKey,
    privateKeys: recovered.privateKeys,
    recoveryPrivateKeys: recovered.kit.recoveryPrivateKeys,
    recoveryVerifier: recovered.kit.recoveryVerifier,
  });
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  // Se cerraron todas las sesiones; la contraseña vieja ya no entra y el kit usado ya no sirve.
  assert.equal((await ana.client.call("GET", "/api/me")).body.user, null);
  assert.notEqual((await new Client().call("POST", "/api/auth/sign-in/email", { email: anaEmail, password: ana.keys.authKey })).status, 200);
  assert.equal((await recovery("start", { email: anaEmail, recoveryAuth: await recoveryProof(ana.recoveryCode) })).status, 403);
  const anaAgain = new Client();
  assert.equal((await anaAgain.call("POST", "/api/auth/sign-in/email", { email: anaEmail, password: anaNew.authKey })).status, 200);
  const meAgain = await anaAgain.call("GET", "/api/me");
  assert.equal((await unlockIdentity(meAgain.body.keys, anaNew.encKey)).signPublicKey, ana.upload.signPublicKey);

  // --- Cambiar la contraseña y pedir un kit nuevo (con sesión) ---
  const anaThird = await derivePasswordKeys(anaEmail, "tercera contraseña de ana", FAST);
  const rewrapped = await rewrapIdentity(meAgain.body.keys.privateKeys, anaNew.encKey, anaThird.encKey);
  assert.equal((await anaAgain.call("POST", "/api/account/password", { currentPassword: anaThird.authKey, newPassword: anaThird.authKey, privateKeys: rewrapped })).status, 403);
  const anaOtherDevice = new Client();
  await anaOtherDevice.call("POST", "/api/auth/sign-in/email", { email: anaEmail, password: anaNew.authKey });
  assert.equal((await anaAgain.call("POST", "/api/account/password", { currentPassword: anaNew.authKey, newPassword: anaThird.authKey, privateKeys: rewrapped })).status, 200);
  // Esta sesión sigue; la del otro dispositivo se cerró.
  assert.ok((await anaAgain.call("GET", "/api/me")).body.user);
  assert.equal((await anaOtherDevice.call("GET", "/api/me")).body.user, null);
  const freshKit = await newRecoveryKit(rewrapped, anaThird.encKey);
  assert.equal((await anaAgain.call("POST", "/api/account/recovery-kit", { password: anaNew.authKey, ...freshKit })).status, 403);
  assert.equal((await anaAgain.call("POST", "/api/account/recovery-kit", { password: anaThird.authKey, ...freshKit })).status, 200);
  assert.equal((await recovery("start", { email: anaEmail, recoveryAuth: await recoveryProof(freshKit.recoveryCode) })).status, 200);

  // --- Dispositivos: se ven sin tokens y se cierra uno ---
  const tablet = new Client();
  await tablet.call("POST", "/api/auth/sign-in/email", { email: anaEmail, password: anaThird.authKey }, { origin: ORIGIN });
  const devices = await anaAgain.call("GET", "/api/account/devices");
  assert.equal(devices.body.devices.length, 2);
  assert.equal(devices.body.devices.filter((device: { current: boolean }) => device.current).length, 1);
  assert.ok(devices.body.devices.every((device: Record<string, unknown>) => !("token" in device)));
  const other = devices.body.devices.find((device: { current: boolean }) => !device.current);
  const currentDevice = devices.body.devices.find((device: { current: boolean }) => device.current);
  // Los encabezados internos falsificados no pueden cambiar la identidad del socket.
  const tabletLive = await persistentLive(tablet, { "X-Refugiar-Session": currentDevice.id, "X-Refugiar-User": flor.userId });
  const retainedLive = await persistentLive(anaAgain);
  assert.equal((await flor.client.call("DELETE", `/api/account/devices/${other.id}`)).status, 200);
  assert.ok((await tablet.call("GET", "/api/me")).body.user); // Otra cuenta no puede revocarlo.
  assert.equal((await anaAgain.call("DELETE", `/api/account/devices/${other.id}`)).status, 200);
  assert.equal((await tablet.call("GET", "/api/me")).body.user, null);
  const afterRevoke = await push({ client: anaAgain }, [await op(ana, "family", anaFamily, { changes: [] })]);
  assert.equal(afterRevoke.status, 200);
  assert.equal(await tabletLive.closed("tablet"), 1008);
  assert.equal(tabletLive.received.length, 1); // Solo el aviso inicial, ninguno posterior a revocar.
  assert.equal(retainedLive.socket.readyState, WebSocket.OPEN);
  assert.equal(retainedLive.received.at(-1), afterRevoke.body.acks[0].seq);
  retainedLive.socket.close();
  await retainedLive.closed("retained");

  // --- Sacar a Flor: claves nuevas de Familia y Adultos para los que quedan ---
  const anaIdentity = await unlockIdentity(meAgain.body.keys, anaNew.encKey);
  const roster = (await anaAgain.call("GET", `/api/households/${householdId}/members`)).body.members as { userId: string; role: string; encPublicKey: string }[];
  const remaining = roster.filter((member) => member.userId !== flor.userId);
  const newFamily = newScopeKey();
  const newAdults = newScopeKey();
  const wrapFor = (raw: Uint8Array, scope: Scope, members: typeof remaining) =>
    Promise.all(members.map(async (member) => ({ userId: member.userId, envelope: await sealEnvelope(raw, member.encPublicKey, envelopeContext(householdId, scope, 2, member.userId)) })));
  const removal = {
    encryptedName: await seal(await importScopeKey(newFamily), "Casa Paredez", `household-name|${householdId}`),
    rotation: [
      { scope: "family", version: 2, envelopes: await wrapFor(newFamily, "family", remaining) },
      { scope: "adults", version: 2, envelopes: await wrapFor(newAdults, "adults", remaining.filter((member) => member.role !== "kid")) },
    ],
  };
  // Faltando alguien (Tomi) en los sobres: hay que rearmarlos. Flor no puede sacar a nadie.
  const missingTomi = { ...removal, rotation: [{ ...removal.rotation[0], envelopes: removal.rotation[0].envelopes.filter((entry) => entry.userId !== kid.userId) }, removal.rotation[1]] };
  assert.equal((await anaAgain.call("POST", `/api/households/${householdId}/members/${flor.userId}/remove`, missingTomi)).status, 409);
  assert.equal((await flor.client.call("POST", `/api/households/${householdId}/members/${kid.userId}/remove`, removal)).status, 403);
  const formerLive = await persistentLive(flor.client);
  const otherTabs = await Promise.all([persistentLive(flor.client), persistentLive(flor.client), persistentLive(flor.client)]);
  assert.equal(await live(ORIGIN, flor.client), "rejected"); // Cuatro conexiones por sesión.
  const removed = await anaAgain.call("POST", `/api/households/${householdId}/members/${flor.userId}/remove`, removal);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  // Flor ya no entra a nada de la casa.
  assert.equal((await flor.client.call("GET", `/api/households/${householdId}/members`)).status, 404);
  assert.equal((await pull(flor)).status, 404);
  // La casa sigue legible con la Familia nueva; lo viejo, con la vieja (Ana guarda los dos sobres).
  const afterRemoval = (await anaAgain.call("GET", "/api/me")).body.households[0];
  assert.equal(afterRemoval.familyKeyVersion, 2);
  const family2 = afterRemoval.envelopes.find((entry: { scope: string; version: number }) => entry.scope === "family" && entry.version === 2);
  const opened2 = await openEnvelope(family2.envelope, anaIdentity, envelopeContext(householdId, "family", 2, ana.userId));
  assert.equal(await openText(opened2.key, afterRemoval.encryptedName, `household-name|${householdId}`), "Casa Paredez");
  // Flor sigue en la lista como ex miembro (para verificar sus cambios viejos), con su clave de firma.
  const withFormer = (await anaAgain.call("GET", `/api/households/${householdId}/members`)).body;
  assert.deepEqual(withFormer.former.map((member: { userId: string; signPublicKey: string }) => [member.userId, member.signPublicKey]), [[flor.userId, flor.upload.signPublicKey]]);
  // Lo nuevo se escribe con la versión nueva; con la vieja, se rechaza.
  const anaSigner = { identity: anaIdentity, userId: ana.userId, client: anaAgain };
  assert.equal((await push(anaSigner, [await op(anaSigner, "family", anaFamily, { changes: [] })])).status, 409);
  assert.equal((await push(anaSigner, [await op(anaSigner, "family", opened2.key, { changes: [] }, { keyVersion: 2 })])).status, 200);
  assert.equal(await formerLive.closed("former"), 1008);
  assert.equal(formerLive.received.length, 1);
  for (const tab of otherTabs) {
    assert.equal(await tab.closed("former tab"), 1008);
    assert.equal(tab.received.length, 1);
  }

  // --- Pasar a alguien a chico rota la clave de Adultos (ya la tenía) ---
  const membersPath = `/api/households/${householdId}/members/${kid.userId}`;
  assert.equal((await anaAgain.call("PATCH", membersPath, { role: "adult" })).status, 200);
  assert.equal((await anaAgain.call("PATCH", membersPath, { role: "kid" })).status, 400);
  const adults3 = newScopeKey();
  const demote = { role: "kid", rotation: { version: 3, envelopes: [{ userId: ana.userId, envelope: await sealEnvelope(adults3, ana.upload.encPublicKey, envelopeContext(householdId, "adults", 3, ana.userId)) }] } };
  assert.equal((await anaAgain.call("PATCH", membersPath, { ...demote, rotation: { ...demote.rotation, version: 2 } })).status, 409);
  assert.equal((await anaAgain.call("PATCH", membersPath, demote)).status, 200);
  assert.equal((await anaAgain.call("GET", "/api/me")).body.households[0].adultsKeyVersion, 3);

  // --- Pausa (plan vencido o pausado): se baja todo, no se sube. Nadie queda sin sus datos. ---
  const listed = (await adminCall("GET", "/platform/households")).body.households as { id: string; members: number; licenseNote: string }[];
  const mine = listed.find((household) => household.id === householdId)!;
  assert.equal(mine.licenseNote, `prueba ${unique}`);
  assert.ok(!("encryptedName" in mine));
  assert.equal((await adminCall("POST", `/platform/households/${householdId}/pause`)).status, 200);
  assert.equal((await anaAgain.call("GET", "/api/me")).body.households[0].planStatus, "paused");
  assert.equal((await pull(anaSigner)).status, 200);
  const paused = await push(anaSigner, [await op(anaSigner, "family", opened2.key, { changes: [] }, { keyVersion: 2 })]);
  assert.equal(paused.status, 402);
  assert.equal(paused.body.error, "plan-paused");
  assert.equal((await adminCall("POST", `/platform/households/${householdId}/resume`)).status, 200);
  assert.equal((await push(anaSigner, [await op(anaSigner, "family", opened2.key, { changes: [] }, { keyVersion: 2 })])).status, 200);

  // --- Fotos: bytes cifrados en el dispositivo; solo adultos administran, todos descargan ---
  const bytes = async (client: Client | null, method: string, path: string, body?: Uint8Array, origin: string | null = ORIGIN) => {
    const headers: Record<string, string> = { "Content-Type": "application/octet-stream" };
    if (origin) headers.Origin = origin;
    if (client) headers.Cookie = [...client.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await fetch(API + path, { method, headers, body: body ? new Uint8Array(body) : undefined });
    return { status: response.status, body: new Uint8Array(await response.arrayBuffer()) };
  };
  const photoPath = `/api/households/${householdId}/photos/${crypto.randomUUID()}`;
  const sealedPhoto = crypto.getRandomValues(new Uint8Array(4_000));
  assert.equal((await bytes(anaAgain, "PUT", `${photoPath}/thumb`, sealedPhoto)).status, 200);
  const downloaded = await bytes(kid.client, "GET", `${photoPath}/thumb`);
  assert.equal(downloaded.status, 200);
  assert.deepEqual(downloaded.body, sealedPhoto);
  // Quien ya no es de la casa, o sin sesión: nada. Una variante inventada tampoco.
  assert.equal((await bytes(flor.client, "GET", `${photoPath}/thumb`)).status, 404);
  assert.equal((await bytes(null, "GET", `${photoPath}/thumb`)).status, 401);
  assert.equal((await bytes(anaAgain, "GET", `${photoPath}/original`)).status, 404);
  // Un chico no administra fotos; sin Origin no se sube; más de 4 MB, tampoco.
  assert.equal((await bytes(kid.client, "PUT", `${photoPath}/thumb`, sealedPhoto)).status, 403);
  assert.equal((await bytes(anaAgain, "PUT", `${photoPath}/full`, sealedPhoto, null)).status, 403);
  assert.equal((await bytes(anaAgain, "PUT", `${photoPath}/full`, new Uint8Array(4 * 1024 * 1024 + 1))).status, 413);
  // En pausa no se sube.
  await adminCall("POST", `/platform/households/${householdId}/pause`);
  assert.equal((await bytes(anaAgain, "PUT", `${photoPath}/full`, sealedPhoto)).status, 402);
  await adminCall("POST", `/platform/households/${householdId}/resume`);
  // Borrar exige el mismo permiso de administración (Tomi no).
  assert.equal((await bytes(kid.client, "DELETE", photoPath)).status, 403);
  assert.equal((await bytes(anaAgain, "DELETE", photoPath)).status, 200);
  assert.equal((await bytes(anaAgain, "GET", `${photoPath}/thumb`)).status, 404);

  // --- Lista de espera: sin cuenta; el operador habilita y el código abre la cuenta y la casa ---
  const waitEmail = `espera-${unique}@casa.test`;
  const waitClient = new Client("198.51.100.60");
  assert.equal((await waitClient.call("POST", "/api/waitlist", { name: "Espera", email: waitEmail })).status, 201);
  assert.equal((await waitClient.call("POST", "/api/waitlist", { name: "Otra", email: waitEmail.toUpperCase() })).status, 201);
  assert.equal((await anaAgain.call("GET", "/api/admin/platform/waitlist")).status, 404);
  const waiting = (await adminCall("GET", "/platform/waitlist")).body.waitlist as { id: string; email: string; status: string }[];
  assert.deepEqual(waiting.filter((row) => row.email === waitEmail).map((row) => row.status), ["waiting"]);
  const enabledNow = await adminCall("POST", "/platform/waitlist/enable", { ids: [waiting.find((row) => row.email === waitEmail)!.id] });
  assert.equal(enabledNow.status, 200, JSON.stringify(enabledNow.body));
  assert.equal(enabledNow.body.enabled[0].emailed, false); // En esta prueba el correo está apagado.
  const waiter = await signUp("Espera", waitEmail, "una frase larga de la lista de espera", "198.51.100.61", { code: enabledNow.body.enabled[0].code });
  const waiterHome = await createHome(waiter, enabledNow.body.enabled[0].code);
  assert.ok(!((await adminCall("GET", "/platform/waitlist")).body.waitlist as { email: string }[]).some((row) => row.email === waitEmail));
  // Tope propio de esa casa, desde el panel: la segunda foto ya no entra y queda anotado en Capacidad.
  const waiterPhotos = `/api/households/${waiterHome.householdId}/photos`;
  assert.equal((await adminCall("PUT", `/platform/households/${waiterHome.householdId}/quotas`, { opsPerDay: null, logBytes: null, photoBytes: 1024 * 1024 })).status, 200);
  assert.equal((await bytes(waiter.client, "PUT", `${waiterPhotos}/${crypto.randomUUID()}/full`, new Uint8Array(700_000))).status, 200);
  assert.equal((await bytes(waiter.client, "PUT", `${waiterPhotos}/${crypto.randomUUID()}/full`, new Uint8Array(700_000))).status, 507);
  const usage = await adminCall("GET", `/platform/households/${waiterHome.householdId}/usage`);
  assert.deepEqual([usage.body.usage.photoBytes, usage.body.limits.photoBytes], [700_000, 1024 * 1024]);
  const capacity = (await adminCall("GET", "/platform/capacity")).body;
  assert.ok(capacity.hits.some((hit: { householdId: string; kind: string }) => hit.householdId === waiterHome.householdId && hit.kind === "photos"));
  assert.equal((await adminCall("PUT", `/platform/households/${waiterHome.householdId}/quotas`, { opsPerDay: null, logBytes: null, photoBytes: null })).status, 200);

  // --- Administración global: sesión normal + correo permitido, nunca el token maestro en el navegador ---
  const publicFeedback = await new Client().call("POST", "/api/feedback", {
    category: "idea",
    email: "persona@casa.test",
    message: "Sería útil poder ordenar mejor las recetas favoritas.",
  });
  assert.equal(publicFeedback.status, 201, JSON.stringify(publicFeedback.body));
  // Las cuentas domésticas nunca obtienen administración, incluso con un correo conocido.
  assert.equal((await flor.client.call("GET", "/api/platform-admin/overview")).status, 404);
  assert.equal((await anaAgain.call("GET", "/api/platform-admin/overview")).status, 404);
  assert.equal((await anaAgain.call("GET", "/api/admin/platform/overview")).status, 404);
  assert.equal((await anaAgain.call("POST", "/api/admin/administrators", {})).status, 404);
  const overview = await adminCall("GET", "/platform/overview");
  assert.equal(overview.status, 200, JSON.stringify(overview.body));
  assert.ok(overview.body.metrics.users >= 3);
  assert.equal(overview.body.credentials.supabaseConfigured, false);
  assert.ok(overview.body.recentAudit.some((entry: { actorEmail: string }) => entry.actorEmail === "operator@localhost.test"));
  const mail = await adminCall("GET", "/platform/mail");
  assert.equal(mail.status, 200);
  assert.equal(mail.body.config, "disabled");
  assert.equal((await adminCall("POST", "/platform/mail/test")).status, 503);
  assert.equal((await adminCall("POST", "/platform/mail/process")).status, 503);

  const users = await adminCall("GET", "/platform/users");
  assert.equal(users.status, 200);
  assert.ok(users.body.users.some((entry: { email: string }) => entry.email === anaEmail));

  // --- Borrar una cuenta: solo sin casas y confirmando su email. Después se puede volver a crear. ---
  const listedUsers = users.body.users as { id: string; deletable: number }[];
  assert.equal(listedUsers.find((entry) => entry.id === ana.userId)!.deletable, 0);
  assert.equal((await adminCall("DELETE", `/platform/users/${ana.userId}`, { confirm: anaEmail })).status, 409);
  // Flor ya no es de la casa, pero su firma sigue verificando sus cambios viejos.
  assert.equal(listedUsers.find((entry) => entry.id === flor.userId)!.deletable, 0);
  assert.equal((await adminCall("DELETE", `/platform/users/${flor.userId}`, { confirm: `flor-${unique}@casa.test` })).status, 409);
  const loneEmail = `sola-${unique}@casa.test`;
  const lone = await signUp("Sola", loneEmail, "una frase larga sin ninguna casa", "198.51.100.7");
  assert.equal((await adminCall("GET", "/platform/users")).body.users.find((entry: { id: string }) => entry.id === lone.userId).deletable, 1);
  assert.equal((await adminCall("DELETE", `/platform/users/${lone.userId}`)).status, 400);
  assert.equal((await adminCall("DELETE", `/platform/users/${lone.userId}`, { confirm: anaEmail })).status, 400);
  assert.equal((await adminCall("DELETE", `/platform/users/${lone.userId}`, { confirm: loneEmail.toUpperCase() })).status, 200);
  assert.equal((await lone.client.call("GET", "/api/me")).body.user, null);
  assert.equal((await adminCall("DELETE", `/platform/users/${lone.userId}`, { confirm: loneEmail })).status, 404);
  assert.ok((await adminCall("GET", "/platform/overview")).body.recentAudit.some((entry: { action: string; targetId: string }) => entry.action === "user.delete" && entry.targetId === lone.userId));
  await signUp("Sola", loneEmail, "otra frase larga, con la cuenta nueva", "198.51.100.7");

  const feedback = await adminCall("GET", "/platform/feedback");
  assert.equal(feedback.status, 200);
  const feedbackId = feedback.body.feedback[0].id as string;
  assert.equal((await adminCall("PATCH", `/platform/feedback/${feedbackId}`, { status: "resolved" })).status, 200);

  const platformLicense = await adminCall("POST", "/platform/licenses", { count: 1, note: "panel" });
  assert.equal(platformLicense.status, 201);
  const platformLicenseId = platformLicense.body.licenses[0].id as string;
  assert.equal((await adminCall("POST", `/platform/licenses/${platformLicenseId}/revoke`)).status, 200);

  assert.equal((await adminCall("POST", `/platform/households/${householdId}/pause`)).status, 200);
  // Aunque esté pausada, una casa reciente no se puede borrar.
  assert.equal((await adminCall("DELETE", `/platform/households/${householdId}`, { confirm: householdId })).status, 409);
  assert.equal((await adminCall("POST", `/platform/households/${householdId}/resume`)).status, 200);
  assert.equal((await adminCall("GET", "/platform/notices")).status, 200);

  // Una cuenta nueva conserva el cupo de contraseña para probar también las llaves y el admin.
  const supportEmail = `soporte-${unique}@casa.test`;
  const support = await signUp("Soporte", supportEmail, "una frase larga para probar el acceso", "198.51.100.9");
  await twoFactorChecks(support.client, support.keys.authKey, supportEmail, support.userId, support.keys.encKey);
});

/** Dos pasos en el Worker: se enciende con la contraseña, frena el ingreso y la llave pide contraseña. */
async function twoFactorChecks(client: Client, authKey: string, email: string, userId: string, encKey: CryptoKey) {
  assert.equal((await client.call("GET", "/api/me")).body.user.twoFactorEnabled, false);
  const enabled = await client.call("POST", "/api/auth/two-factor/enable", { password: authKey });
  assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
  const bits = [...new URL(enabled.body.totpURI).searchParams.get("secret")!].map((char) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char).toString(2).padStart(5, "0")).join("");
  const secret = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2))).toString();
  const code = () => createOTP(secret).totp();
  assert.equal((await client.call("POST", "/api/auth/two-factor/verify-totp", { code: await code() })).status, 200);
  assert.equal((await client.call("GET", "/api/me")).body.user.twoFactorEnabled, true);

  // Sumar una llave de acceso pide la contraseña (aunque haya sesión).
  assert.equal((await client.call("GET", "/api/auth/passkey/generate-register-options")).status, 200);
  assert.equal((await client.call("POST", "/api/auth/passkey/verify-registration", { response: {} })).status, 403);
  assert.equal((await client.call("POST", "/api/auth/passkey/verify-registration", { response: {}, password: "x".repeat(43) })).status, 403);

  const device = new Client();
  const signIn = await device.call("POST", "/api/auth/sign-in/email", { email, password: authKey });
  assert.equal(signIn.body.twoFactorRedirect, true);
  assert.equal((await device.call("GET", "/api/me")).body.user, null);
  assert.equal((await device.call("POST", "/api/auth/two-factor/verify-totp", { code: await code() })).status, 200);
  assert.equal((await device.call("GET", "/api/me")).body.user.email, email);

  const passkeys = [];
  for (const name of ["Segundo paso", "Abre los datos"]) {
    const key = softwareAuthenticator({ origin: ORIGIN, rpId: new URL(API).hostname });
    const options = await client.call("GET", "/api/auth/passkey/generate-register-options");
    assert.equal(options.status, 200);
    const registered = await client.call("POST", "/api/auth/passkey/verify-registration", { response: key.register(options.body.challenge), name, password: authKey });
    assert.equal(registered.status, 200, JSON.stringify(registered.body));
    passkeys.push({ id: registered.body.id as string, key });
  }
  const unlocking = passkeys[1];
  const keys = (await client.call("GET", "/api/me")).body.keys;
  const privateKeys = await wrapForPasskey(keys.privateKeys, encKey, crypto.getRandomValues(new Uint8Array(32)), unlocking.key.id);
  assert.equal((await client.call("POST", `/api/account/passkeys/${unlocking.id}/unlock`, { password: authKey, privateKeys })).status, 201);
  assert.equal((await client.call("GET", "/api/account/passkeys")).body.passkeys.length, 2);

  // El operador quita el segundo paso sin perder las claves ni la llave que las abre.
  assert.equal((await adminCall("POST", `/platform/users/${userId}/reset/two-factor`)).status, 200);
  const afterReset = await client.call("GET", "/api/me");
  assert.equal(afterReset.body.user.twoFactorEnabled, false);
  assert.equal(afterReset.body.keys.privateKeys, keys.privateKeys);
  assert.deepEqual((await client.call("GET", "/api/account/passkeys")).body.passkeys.map((entry: { id: string }) => entry.id), [unlocking.id]);
  const passwordOnly = new Client("198.51.100.8");
  assert.equal((await passwordOnly.call("POST", "/api/auth/sign-in/email", { email, password: authKey })).body.twoFactorRedirect, undefined);
  assert.equal((await passwordOnly.call("GET", "/api/me")).body.user.id, userId);

  assert.equal((await adminCall("POST", `/platform/users/${userId}/reset/passkeys`)).status, 200);
  assert.deepEqual((await client.call("GET", "/api/account/passkeys")).body.passkeys, []);
  assert.equal((await client.call("GET", `/api/account/passkeys/unlock/${unlocking.key.id}`)).status, 404);
  assert.equal((await adminCall("POST", `/platform/users/${userId}/reset/sessions`)).status, 200);
  for (const session of [client, device, passwordOnly]) assert.equal((await session.call("GET", "/api/me")).body.user, null);
  assert.equal((await adminCall("POST", "/platform/users/nonexistent/reset/two-factor")).status, 404);
  const audit = (await adminCall("GET", "/platform/overview")).body.recentAudit;
  for (const action of ["two-factor", "passkeys", "sessions"]) {
    assert.ok(audit.some((entry: { action: string; targetId: string }) => entry.action === `user.reset.${action}` && entry.targetId === userId));
  }
}

type Account = Awaited<ReturnType<typeof signUp>>;

/** Una casa nueva de `owner`, con sus tres claves de nivel ensobradas para quien la crea. */
async function createHome(owner: Account, accessCode: string) {
  const householdId = crypto.randomUUID();
  const raw: Record<Scope, Uint8Array> = { family: newScopeKey(), adults: newScopeKey(), private: newScopeKey() };
  const encryptedName = await seal(await importScopeKey(raw.family), "Casa", `household-name|${householdId}`);
  const envelopes = await Promise.all(
    (Object.keys(raw) as Scope[]).map(async (scope) => ({ scope, version: 1, envelope: await sealEnvelope(raw[scope], owner.upload.encPublicKey, envelopeContext(householdId, scope, 1, owner.userId)) })),
  );
  const created = await owner.client.call("POST", "/api/households", { id: householdId, encryptedName, envelopes, accessCode });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return { householdId, raw };
}

/** `owner` invita a `guest` como adulta y aprueba su pedido. */
async function joinHome(owner: Account, guest: Account, home: Awaited<ReturnType<typeof createHome>>) {
  const invite = await inviteSecrets();
  const inviteId = crypto.randomUUID();
  const wrappedKeys = JSON.stringify({
    family: { version: 1, key: await seal(invite.wrapKey, home.raw.family, `invite|${inviteId}|family`) },
    adults: { version: 1, key: await seal(invite.wrapKey, home.raw.adults, `invite|${inviteId}|adults`) },
  });
  const tokenHash = await sha256(invite.authToken);
  assert.equal((await owner.client.call("POST", `/api/households/${home.householdId}/invites`, { id: inviteId, role: "adult", tokenHash, wrappedKeys })).status, 201);
  const envelopes = await Promise.all(
    (["family", "adults", "private"] as Scope[]).map(async (scope) => ({
      scope,
      version: 1,
      envelope: await sealEnvelope(scope === "private" ? newScopeKey() : home.raw[scope], guest.upload.encPublicKey, envelopeContext(home.householdId, scope, 1, guest.userId)),
    })),
  );
  assert.equal((await guest.client.call("POST", `/api/invites/${inviteId}/accept`, { authToken: invite.authToken, envelopes })).status, 202);
  assert.equal((await owner.client.call("POST", `/api/households/${home.householdId}/join-requests/${inviteId}/approve`)).status, 200);
}

test("cada persona borra su cuenta: sola, de una casa compartida y como última admin", async () => {
  const issued = await adminCall("POST", "/platform/licenses", { count: 2, note: `borrado ${unique}` });
  assert.equal(issued.status, 201, JSON.stringify(issued.body));
  const [soloLicense, sharedLicense] = issued.body.licenses as { code: string }[];
  const users = async () => (await adminCall("GET", "/platform/users")).body.users as { id: string; email: string; name: string }[];
  const households = async () => ((await adminCall("GET", "/platform/households")).body.households as { id: string }[]).map((household) => household.id);

  // Sola en su casa: se borran la cuenta entera y la casa.
  const soloEmail = `borrar-sola-${unique}@casa.test`;
  const solo = await signUp("Sola", soloEmail, "una frase larga para borrarme", "203.0.113.21");
  const soloHome = await createHome(solo, soloLicense.code);
  assert.equal((await solo.client.call("POST", "/api/account/delete", { confirm: "otra@casa.test" })).status, 400);
  assert.equal((await solo.client.call("POST", "/api/account/delete", { confirm: soloEmail }, { origin: "https://ajeno.test" })).status, 403);
  assert.equal((await new Client().call("POST", "/api/account/delete", { confirm: soloEmail })).status, 401);
  const soloDeleted = await solo.client.call("POST", "/api/account/delete", { confirm: soloEmail.toUpperCase() });
  assert.equal(soloDeleted.status, 200, JSON.stringify(soloDeleted.body));
  assert.equal((await solo.client.call("GET", "/api/me")).body.user, null);
  assert.ok(!(await users()).some((user) => user.id === solo.userId));
  assert.ok(!(await households()).includes(soloHome.householdId));
  const again = new Client("203.0.113.22");
  assert.notEqual((await again.call("POST", "/api/auth/sign-in/email", { email: soloEmail, password: solo.keys.authKey })).status, 200);

  // Casa compartida: la única admin no se puede ir dejando a los demás sin quien administre.
  const owner = await signUp("Dueña", `borrar-duena-${unique}@casa.test`, "una frase larga para la duena", "203.0.113.23");
  const guestEmail = `borrar-invitada-${unique}@casa.test`;
  const guest = await signUp("Invitada", guestEmail, "una frase larga para la invitada", "203.0.113.24");
  const home = await createHome(owner, sharedLicense.code);
  await joinHome(owner, guest, home);
  const blocked = await owner.client.call("POST", "/api/account/delete", { confirm: `borrar-duena-${unique}@casa.test` });
  assert.equal(blocked.status, 409);
  assert.deepEqual(blocked.body, { error: "last-admin", households: [home.householdId] });

  // La invitada se va: queda sin email, nombre, sesión ni claves privadas, pero su firma sigue
  // verificando sus cambios viejos.
  assert.equal((await guest.client.call("POST", "/api/account/delete", { confirm: guestEmail })).status, 200);
  assert.equal((await guest.client.call("GET", "/api/me")).body.user, null);
  assert.notEqual((await new Client("203.0.113.25").call("POST", "/api/auth/sign-in/email", { email: guestEmail, password: guest.keys.authKey })).status, 200);
  const roster = await owner.client.call("GET", `/api/households/${home.householdId}/members`);
  assert.deepEqual(roster.body.members.map((member: { userId: string }) => member.userId), [owner.userId]);
  const former = roster.body.former.find((member: { userId: string }) => member.userId === guest.userId);
  assert.equal(former.name, "");
  assert.equal(former.signPublicKey, guest.upload.signPublicKey);
  const pseudonym = (await users()).find((user) => user.id === guest.userId)!;
  assert.equal(pseudonym.email, `deleted-${guest.userId}@deleted.invalid`);
  assert.ok(!(await users()).some((user) => user.email === guestEmail));

  // Ya sola, la dueña se puede ir: la casa y su cuenta se borran.
  assert.equal((await owner.client.call("POST", "/api/account/delete", { confirm: `borrar-duena-${unique}@casa.test` })).status, 200);
  assert.ok(!(await households()).includes(home.householdId));
  assert.ok(!(await users()).some((user) => user.id === owner.userId));
});

/** Un código para vincular el celular de un chico: lleva solo la clave de Familia. */
async function deviceInvite(owner: Account, home: Awaited<ReturnType<typeof createHome>>) {
  const invite = await inviteSecrets();
  const inviteId = crypto.randomUUID();
  const wrappedKeys = JSON.stringify({ family: { version: 1, key: await seal(invite.wrapKey, home.raw.family, `invite|${inviteId}|family`) } });
  const created = await owner.client.call("POST", `/api/households/${home.householdId}/invites`, { id: inviteId, role: "kid", kind: "device", tokenHash: await sha256(invite.authToken), wrappedKeys });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  return { inviteId, invite, expiresAt: created.body.expiresAt as number };
}

/** Lo que hace el celular al escanear el código: crea sus claves y su id, y arma sus sobres. */
async function phoneFor(home: Awaited<ReturnType<typeof createHome>>, code: Awaited<ReturnType<typeof deviceInvite>>, familyVersion = 1) {
  const phone = await createDeviceIdentity();
  const userId = crypto.randomUUID();
  const envelopes = [
    { scope: "family", version: familyVersion, envelope: await sealEnvelope(home.raw.family, phone.identity.encPublicKey, envelopeContext(home.householdId, "family", familyVersion, userId)) },
    { scope: "private", version: 1, envelope: await sealEnvelope(newScopeKey(), phone.identity.encPublicKey, envelopeContext(home.householdId, "private", 1, userId)) },
  ];
  const body = { inviteId: code.inviteId, authToken: code.invite.authToken, userId, devicePublicKey: phone.devicePublicKey, encPublicKey: phone.identity.encPublicKey, signPublicKey: phone.identity.signPublicKey, envelopes };
  return { ...phone, userId, body };
}

/** Entrar con la llave del celular: pide un desafío y lo firma. */
async function deviceSignIn(client: Client, userId: string, deviceKey: CryptoKey) {
  const { challenge } = (await client.call("POST", "/api/auth/device/challenge", { userId })).body as { challenge: string };
  const signature = await signWithDevice(deviceKey, deviceSignInData(userId, challenge));
  return { challenge, signature, result: await client.call("POST", "/api/auth/device/sign-in", { userId, challenge, signature }) };
}

test("el celular de un chico entra sin email ni contraseña, solo a lo de la familia", async () => {
  const issued = await adminCall("POST", "/platform/licenses", { count: 1, note: `celular ${unique}` });
  assert.equal(issued.status, 201, JSON.stringify(issued.body));
  const mom = await signUp("Mamá", `celular-mama-${unique}@casa.test`, "una frase larga para la mama", "203.0.113.31");
  const home = await createHome(mom, (issued.body.licenses as { code: string }[])[0].code);

  // El código es solo para un chico y vence en minutos.
  const wrong = { id: crypto.randomUUID(), role: "adult", kind: "device", tokenHash: await sha256("x".repeat(43)), wrappedKeys: JSON.stringify({ family: "x".repeat(30) }) };
  assert.equal((await mom.client.call("POST", `/api/households/${home.householdId}/invites`, wrong)).status, 400);
  const code = await deviceInvite(mom, home);
  assert.ok(code.expiresAt - Date.now() <= 15 * 60_000 + 5_000);
  // Tampoco sirve para crear una cuenta con email.
  const viaDevice = await new Client("203.0.113.35").call("POST", "/api/auth/sign-up/email", { name: "X", email: `celular-x-${unique}@casa.test`, password: "x".repeat(43), access: { invite: { id: code.inviteId, authToken: code.invite.authToken } } });
  assert.equal(viaDevice.status, 403);
  const preview = await new Client().call("POST", `/api/invites/${code.inviteId}/preview`, { authToken: code.invite.authToken });
  assert.equal(preview.body.kind, "device");
  assert.equal(preview.body.role, "kid");

  // Una cuenta con email no lo puede usar: es para un celular.
  const aunt = await signUp("Tía", `celular-tia-${unique}@casa.test`, "una frase larga para la tia", "203.0.113.32");
  const auntEnvelopes = [{ scope: "family", version: 1, envelope: await sealEnvelope(home.raw.family, aunt.upload.encPublicKey, envelopeContext(home.householdId, "family", 1, aunt.userId)) }];
  assert.equal((await aunt.client.call("POST", `/api/invites/${code.inviteId}/accept`, { authToken: code.invite.authToken, envelopes: auntEnvelopes })).status, 400);

  // El celular se vincula. Con la clave de Adultos o con un id que ya existe, no. El código sirve una vez.
  const phone = await phoneFor(home, code);
  const adults = { scope: "adults", version: 1, envelope: await sealEnvelope(home.raw.adults, phone.identity.encPublicKey, envelopeContext(home.householdId, "adults", 1, phone.userId)) };
  assert.equal((await new Client().call("POST", "/api/devices/link", { ...phone.body, envelopes: [...phone.body.envelopes, adults] })).status, 400);
  assert.equal((await new Client().call("POST", "/api/devices/link", { ...phone.body, userId: aunt.userId })).status, 400);
  const linked = await new Client().call("POST", "/api/devices/link", phone.body);
  assert.equal(linked.status, 202, JSON.stringify(linked.body));
  assert.equal((await new Client().call("POST", "/api/devices/link", { ...phone.body, userId: crypto.randomUUID() })).status, 410);

  // Entra firmando con su llave. Con otra llave, o con un desafío ya usado, no.
  const kid = new Client("203.0.113.33");
  const intruder = await createDeviceIdentity();
  assert.equal((await deviceSignIn(kid, phone.userId, intruder.deviceKey)).result.status, 401);
  const signedIn = await deviceSignIn(kid, phone.userId, phone.deviceKey);
  assert.equal(signedIn.result.status, 200, JSON.stringify(signedIn.result.body));
  assert.equal((await new Client().call("POST", "/api/auth/device/sign-in", { userId: phone.userId, challenge: signedIn.challenge, signature: signedIn.signature })).status, 401);
  const pending = await kid.call("GET", "/api/me");
  assert.equal(pending.body.user.id, phone.userId);
  assert.equal(pending.body.user.device, true);
  assert.equal(pending.body.user.name, "");
  assert.deepEqual(pending.body.households, []);
  // Sin contraseña ni kit: no hay nada que recuperar ni con qué entrar por email.
  assert.equal(pending.body.keys.privateKeys, "");
  // La sesión del celular no guarda su navegador (ni su IP).
  assert.deepEqual((await kid.call("GET", "/api/account/devices")).body.devices.map((entry: { userAgent: string }) => entry.userAgent), [""]);

  // La mamá ve un celular, sin email, y lo aprueba.
  const requests = await mom.client.call("GET", `/api/households/${home.householdId}/join-requests`);
  assert.deepEqual(requests.body.requests.map((request: { id: string; email: string; device: number }) => [request.id, request.email, Boolean(request.device)]), [[code.inviteId, "", true]]);
  assert.equal((await mom.client.call("POST", `/api/households/${home.householdId}/join-requests/${code.inviteId}/approve`)).status, 200);
  const joined = (await kid.call("GET", "/api/me")).body.households[0];
  assert.equal(joined.role, "kid");
  assert.deepEqual(joined.envelopes.map((entry: { scope: string }) => entry.scope).sort(), ["family", "private"]);
  const family = joined.envelopes.find((entry: { scope: string }) => entry.scope === "family");
  assert.deepEqual((await openEnvelope(family.envelope, phone.identity, envelopeContext(home.householdId, "family", 1, phone.userId))).raw, home.raw.family);
  const roster = await mom.client.call("GET", `/api/households/${home.householdId}/members`);
  assert.deepEqual(roster.body.members.map((member: { userId: string; device: number }) => [member.userId, Boolean(member.device)]), [[mom.userId, false], [phone.userId, true]]);

  // Sigue siendo el celular de un chico: no se le cambia el rol.
  assert.equal((await mom.client.call("PATCH", `/api/households/${home.householdId}/members/${phone.userId}`, { role: "adult" })).status, 409);

  // Desvincularlo rota Familia, y el celular ya no entra.
  const newFamily = newScopeKey();
  const removal = {
    encryptedName: await seal(await importScopeKey(newFamily), "Casa", `household-name|${home.householdId}`),
    rotation: [{ scope: "family", version: 2, envelopes: [{ userId: mom.userId, envelope: await sealEnvelope(newFamily, mom.upload.encPublicKey, envelopeContext(home.householdId, "family", 2, mom.userId)) }] }],
  };
  assert.equal((await mom.client.call("POST", `/api/households/${home.householdId}/members/${phone.userId}/remove`, removal)).status, 200);
  assert.equal((await kid.call("GET", "/api/me")).body.user, null);
  assert.equal((await deviceSignIn(kid, phone.userId, phone.deviceKey)).result.status, 401);

  // Un pedido rechazado borra la cuenta del celular entera.
  const home2 = { ...home, raw: { ...home.raw, family: newFamily } };
  const code2 = await deviceInvite(mom, home2);
  const phone2 = await phoneFor(home2, code2, 2);
  assert.equal((await new Client().call("POST", "/api/devices/link", phone2.body)).status, 202);
  assert.equal((await mom.client.call("DELETE", `/api/households/${home.householdId}/join-requests/${code2.inviteId}`)).status, 200);
  assert.equal((await deviceSignIn(new Client("203.0.113.34"), phone2.userId, phone2.deviceKey)).result.status, 401);
  assert.ok(!((await adminCall("GET", "/platform/users")).body.users as { id: string }[]).some((user) => user.id === phone2.userId));
});
