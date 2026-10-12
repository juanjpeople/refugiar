/**
 * Cuentas, casas e invitaciones en la nube, con cifrado de extremo a extremo. Todo lo sensible
 * (nombres de casas, claves de nivel) se cifra o descifra acá, en el dispositivo; a la API van
 * claves públicas y cajas cifradas.
 */
import { api, CloudError } from "@/lib/cloud/api";
import { ValidationError } from "@/lib/errors";
import { clearVault, loadDeviceAccount, loadIdentity, saveIdentity } from "@/lib/cloud/vault";
import { deviceSignInData } from "@/lib/cloud/device-protocol";
import {
  createDeviceIdentity,
  createIdentity,
  derivePasswordKeys,
  envelopeContext,
  fromB64u,
  importScopeKey,
  inviteSecrets,
  newRecoveryKit,
  newScopeKey,
  open,
  openEnvelope,
  openText,
  PASSKEY_PRF_SALT,
  recoverIdentity,
  recoveryProof,
  rewrapIdentity,
  seal,
  sealEnvelope,
  sha256,
  signWithDevice,
  unlockIdentity,
  unlockWithPasskey,
  wrapForPasskey,
  type Identity,
  type Scope,
} from "@/lib/crypto";
import { startAuthentication, startRegistration, type PublicKeyCredentialCreationOptionsJSON, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import type { CloudDevice, CloudHousehold, CloudInvite, CloudMember, CloudPasskey, CloudRole, CloudUser, FormerMember, InviteMember, InvitePreview, JoinRequest, SecondStepProof } from "./domain";

interface MeResponse {
  /** `null` si no hay sesión. */
  user: CloudUser | null;
  keys: { kdfVersion: number; encPublicKey: string; signPublicKey: string; privateKeys: string } | null;
  households: Omit<CloudHousehold, "name">[];
}

const nameContext = (householdId: string) => `household-name|${householdId}`;
const inviteContext = (inviteId: string, scope: Scope | "member") => `invite|${inviteId}|${scope}`;

/** Niveles que puede abrir cada rol (igual que el servidor). */
export function scopesFor(role: CloudRole): Scope[] {
  return role === "kid" ? ["family", "private"] : ["family", "adults", "private"];
}

export interface CloudSession {
  user: CloudUser;
  identity: Identity;
  households: CloudHousehold[];
}

async function decryptHouseholds(me: MeResponse & { user: CloudUser }, identity: Identity): Promise<CloudHousehold[]> {
  return Promise.all(
    me.households.map(async (household) => {
      let name = "";
      try {
        const { key } = await openScopeKey(identity, me.user.id, household, "family");
        name = await openText(key, household.encryptedName, nameContext(household.id));
      } catch {
        // Un sobre que no abre (claves rotadas, error): la casa se muestra igual, sin nombre.
      }
      return { ...household, name };
    }),
  );
}

/** Abre la clave de un nivel de una casa (de su sobre, con la identidad del dispositivo). */
export async function openScopeKey(identity: Identity, userId: string, household: Pick<CloudHousehold, "id" | "envelopes" | "familyKeyVersion" | "adultsKeyVersion">, scope: Scope) {
  const version = scope === "family" ? household.familyKeyVersion : scope === "adults" ? household.adultsKeyVersion : 1;
  const entry = household.envelopes.find((envelope) => envelope.scope === scope && envelope.version === version);
  if (!entry) throw new Error("no-envelope");
  return openEnvelope(entry.envelope, identity, envelopeContext(household.id, scope, version, userId));
}

async function sessionFrom(me: MeResponse, identity: Identity): Promise<CloudSession> {
  if (!me.user) throw new Error("no-session");
  const user = me.user;
  await saveIdentity({ userId: user.id, email: user.email, identity, savedAt: Date.now() });
  return { user, identity, households: await decryptHouseholds({ ...me, user }, identity) };
}

/**
 * Nube cerrada: con qué se crea la cuenta. El código de acceso (la licencia; no se consume hasta
 * crear la casa) o la invitación que se abrió. El secreto del link no viaja: solo su prueba.
 */
export type SignUpAccess = { code: string } | { invite: { id: string; secret: string } };

async function signUpAccess(access: SignUpAccess) {
  if ("code" in access) return { code: access.code.trim() };
  return { invite: { id: access.invite.id, authToken: (await inviteSecrets(access.invite.secret)).authToken } };
}

/**
 * Crea la cuenta: deriva las claves de la contraseña, crea la identidad y el kit de recuperación,
 * y sube solo lo público y lo cifrado. Devuelve el código del kit (se muestra una sola vez).
 */
export async function signUp(input: { name: string; email: string; password: string }, access: SignUpAccess): Promise<{ session: CloudSession; recoveryCode: string }> {
  const keys = await derivePasswordKeys(input.email, input.password);
  await api("POST", "/auth/sign-up/email", { name: input.name.trim(), email: input.email.trim(), password: keys.authKey, access: await signUpAccess(access) });
  const { identity, upload, recoveryCode } = await createIdentity(keys.encKey);
  await api("POST", "/keys", upload);
  const me = await api<MeResponse>("GET", "/me");
  return { session: await sessionFrom(me, identity), recoveryCode };
}

/**
 * Con la verificación en dos pasos, la contraseña deja el ingreso a medio camino: falta el código
 * o la llave de acceso. `finish` termina de abrir la sesión (las claves ya salieron de la contraseña
 * y quedan solo en memoria mientras tanto).
 */
export interface SecondStep {
  finish: () => Promise<CloudSession>;
}

export type SignInResult = { session: CloudSession } | { secondStep: SecondStep };

async function openWithPassword(encKey: CryptoKey): Promise<CloudSession> {
  const me = await api<MeResponse>("GET", "/me");
  if (!me.keys) throw new Error("no-keys");
  return sessionFrom(me, await unlockIdentity(me.keys, encKey));
}

/** Entra en un dispositivo: la contraseña abre la identidad guardada (cifrada) en la nube. */
export async function signIn(input: { email: string; password: string }): Promise<SignInResult> {
  const keys = await derivePasswordKeys(input.email, input.password);
  const result = await api<{ twoFactorRedirect?: boolean }>("POST", "/auth/sign-in/email", { email: input.email.trim(), password: keys.authKey });
  if (result?.twoFactorRedirect) return { secondStep: { finish: () => openWithPassword(keys.encKey) } };
  return { session: await openWithPassword(keys.encKey) };
}

/** ¿Este navegador puede usar llaves de acceso? */
export function passkeysSupported() {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";
}

// --- Llaves que abren los datos (PRF) -------------------------------------------------------

/** Pide a la llave su secreto (extensión PRF). El navegador lo pasa tal cual al autenticador. */
function withPrf<T extends object>(options: T): T {
  return { ...options, extensions: { ...(options as { extensions?: object }).extensions, prf: { eval: { first: PASSKEY_PRF_SALT } } } };
}

function prfBytes(results: unknown): Uint8Array | null {
  const first = (results as { prf?: { results?: { first?: BufferSource } } } | undefined)?.prf?.results?.first;
  if (!first) return null;
  return first instanceof ArrayBuffer ? new Uint8Array(first) : new Uint8Array(first.buffer, first.byteOffset, first.byteLength);
}

/** Saca el secreto de la respuesta y lo borra de ella: nunca va al servidor. */
function takePrf(response: { clientExtensionResults: unknown }): Uint8Array | null {
  const prf = prfBytes(response.clientExtensionResults);
  response.clientExtensionResults = {};
  return prf;
}

/**
 * Algunos autenticadores dan el secreto recién al usar la llave, no al crearla: se usa una vez acá,
 * en el dispositivo (no hace falta el servidor). `null` si el dispositivo no lo da.
 */
async function evaluatePrf(credentialId: string): Promise<Uint8Array | null> {
  try {
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: fromB64u(credentialId) }],
        userVerification: "required",
        extensions: { prf: { eval: { first: PASSKEY_PRF_SALT } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
    return prfBytes(credential?.getClientExtensionResults());
  } catch {
    return null;
  }
}

/**
 * Entrar con una llave de acceso, sin contraseña: la llave verifica a la persona (huella, cara o
 * PIN) y da el secreto que abre la copia de las claves. Si el dispositivo no da el secreto, no se
 * abre la sesión: sin las claves no se pueden leer los datos.
 */
export async function signInWithPasskey(): Promise<CloudSession> {
  const optionsJSON = await api<PublicKeyCredentialRequestOptionsJSON>("GET", "/auth/passkey/generate-authenticate-options");
  const response = await startAuthentication({ optionsJSON: withPrf({ ...optionsJSON, userVerification: "required" }) }).catch(() => {
    throw new CloudError("passkey-cancelled", 0);
  });
  const prf = takePrf(response);
  if (!prf) throw new CloudError("passkey-no-prf", 0);
  await api("POST", "/auth/passkey/verify-authentication", { response }).catch((error: unknown) => {
    throw error instanceof CloudError && error.code === "TWO_FACTOR_REQUIRED" ? new CloudError("passkey-second-step", 401) : error;
  });
  try {
    const me = await api<MeResponse>("GET", "/me");
    if (!me.user || !me.keys) throw new Error("no-keys");
    const { privateKeys } = await api<{ privateKeys: string }>("GET", `/account/passkeys/unlock/${encodeURIComponent(response.id)}`);
    return await sessionFrom(me, await unlockWithPasskey(me.keys, privateKeys, prf, response.id));
  } catch {
    // Sesión sin claves: no sirve. Se cierra y se pide la contraseña.
    await api("POST", "/auth/sign-out", {}).catch(() => {});
    throw new CloudError("passkey-locked", 0);
  }
}

/** Completa el segundo paso del ingreso (deja la sesión abierta en el servidor). */
export async function verifySecondStep(proof: SecondStepProof) {
  if (proof.kind === "code") return void (await api("POST", "/auth/two-factor/verify-totp", { code: proof.code.trim() }));
  if (proof.kind === "backup") return void (await api("POST", "/auth/two-factor/verify-backup-code", { code: proof.code.trim() }));
  const optionsJSON = await api<PublicKeyCredentialRequestOptionsJSON>("GET", "/auth/passkey/generate-authenticate-options");
  const response = await startAuthentication({ optionsJSON }).catch(() => {
    throw new CloudError("passkey-cancelled", 0);
  });
  await api("POST", "/auth/passkey/verify-authentication", { response });
}

/** Una sesión OAuth prueba identidad; la contraseña abre las claves localmente, sin reenviarla. */
export async function unlockAuthenticatedSession(password: string): Promise<CloudSession> {
  const me = await api<MeResponse>("GET", "/me");
  if (!me.user || !me.keys) throw new Error("no-encrypted-identity");
  const keys = await derivePasswordKeys(me.user.email, password);
  return sessionFrom(me, await unlockIdentity(me.keys, keys.encKey));
}

/**
 * Al abrir la app: si hay sesión y este dispositivo tiene la identidad, entra sin pedir nada.
 * `null` = no hay sesión. Sin conexión (o con el servidor caído) lanza: no es lo mismo que no tener sesión.
 */
export async function restoreSession(): Promise<CloudSession | null> {
  let me = await api<MeResponse>("GET", "/me");
  if (!me.user) {
    // El celular de un chico no tiene contraseña: si venció la sesión, vuelve a entrar con su llave.
    const device = await loadDeviceAccount();
    if (!device) return null;
    try {
      await deviceSignIn(device.userId, device.deviceKey);
    } catch (error) {
      // Lo desvincularon: queda sin sesión hasta que lo vuelvan a vincular.
      if (error instanceof CloudError && error.status === 401) return null;
      throw error;
    }
    me = await api<MeResponse>("GET", "/me");
    if (!me.user) return null;
  }
  const stored = await loadIdentity(me.user.id);
  if (!stored) return null;
  return { user: me.user, identity: stored.identity, households: await decryptHouseholds({ ...me, user: me.user }, stored.identity) };
}

export async function signOut() {
  await api("POST", "/auth/sign-out", {}).catch(() => {});
  await clearVault();
}

export async function refreshHouseholds(session: CloudSession): Promise<CloudHousehold[]> {
  const me = await api<MeResponse>("GET", "/me");
  if (!me.user) throw new Error("no-session");
  return decryptHouseholds({ ...me, user: me.user }, session.identity);
}

/** ¿Sirve este código de licencia? Se pregunta antes de crear la cuenta (no la consume). */
export async function checkLicense(code: string): Promise<boolean> {
  return (await api<{ valid: boolean }>("POST", "/licenses/check", { code: code.trim() })).valid;
}

/**
 * Crea una casa: tres claves de nivel nuevas, ensobradas para quien la crea (admin). La nube es
 * opcional y pide una licencia (`accessCode`): el servidor la consume en la misma transacción.
 */
export async function createHousehold(session: CloudSession, name: string, accessCode: string): Promise<string> {
  const id = crypto.randomUUID();
  const raw: Record<Scope, Uint8Array> = { family: newScopeKey(), adults: newScopeKey(), private: newScopeKey() };
  const encryptedName = await seal(await importScopeKey(raw.family), name.trim(), nameContext(id));
  const envelopes = await Promise.all(
    (Object.keys(raw) as Scope[]).map(async (scope) => ({
      scope,
      version: 1,
      envelope: await sealEnvelope(raw[scope], session.identity.encPublicKey, envelopeContext(id, scope, 1, session.user.id)),
    })),
  );
  await api("POST", "/households", { id, encryptedName, envelopes, accessCode: accessCode.trim() });
  return id;
}

/**
 * Invitación por link: las claves de la casa que le corresponden al rol viajan cifradas con una
 * clave que sale del secreto del link (#…). El servidor guarda solo el hash del token.
 */
/**
 * Una invitación de un solo uso. Con `member`, es para ese perfil de la casa: quien la abre entra
 * directo como esa persona (el perfil viaja cifrado con el secreto del link, el servidor no lo ve).
 */
export async function createInvite(
  session: CloudSession,
  household: CloudHousehold,
  role: CloudRole,
  origin: string,
  member?: InviteMember,
  { device = false }: { device?: boolean } = {},
): Promise<{ id: string; link: string; expiresAt: number }> {
  const id = crypto.randomUUID();
  const secrets = await inviteSecrets();
  const carried: Record<string, unknown> = { name: household.encryptedName };
  if (member) carried.member = await seal(secrets.wrapKey, JSON.stringify(member), inviteContext(id, "member"));
  for (const scope of scopesFor(role).filter((scope) => scope !== "private")) {
    const { raw } = await openScopeKey(session.identity, session.user.id, household, scope);
    const version = scope === "family" ? household.familyKeyVersion : household.adultsKeyVersion;
    carried[scope] = { version, key: await seal(secrets.wrapKey, raw, inviteContext(id, scope)) };
  }
  const result = await api<{ expiresAt: number }>("POST", `/households/${household.id}/invites`, {
    id,
    role,
    tokenHash: await sha256(secrets.authToken),
    wrappedKeys: JSON.stringify(carried),
    expiresInDays: 7,
    kind: device ? "device" : "account",
  });
  return { id, link: `${origin}/unirme#${id}.${secrets.secret}`, expiresAt: result.expiresAt };
}

/** Lee el link de invitación (`…/unirme#<id>.<secreto>`). */
export function parseInviteLink(hash: string): { id: string; secret: string } | null {
  const match = hash.replace(/^#/, "").match(/^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/);
  return match ? { id: match[1], secret: match[2] } : null;
}

interface PreviewResponse {
  householdId: string;
  role: CloudRole;
  kind?: "account" | "device";
  wrappedKeys: string;
  inviterName: string;
  expiresAt: number;
}

/** Antes de tener cuenta: quién invita, a qué casa (se descifra acá con el secreto) y con qué rol. */
export async function previewInvite(id: string, secret: string): Promise<InvitePreview> {
  const secrets = await inviteSecrets(secret);
  const preview = await api<PreviewResponse>("POST", `/invites/${id}/preview`, { authToken: secrets.authToken });
  const carried = JSON.parse(preview.wrappedKeys) as { name: string; family: { key: string }; member?: string };
  const family = await importScopeKey(await open(secrets.wrapKey, carried.family.key, inviteContext(id, "family")));
  return {
    member: carried.member ? (JSON.parse(await openText(secrets.wrapKey, carried.member, inviteContext(id, "member"))) as InviteMember) : undefined,
    householdId: preview.householdId,
    householdName: await openText(family, carried.name, nameContext(preview.householdId)),
    inviterName: preview.inviterName,
    role: preview.role,
    expiresAt: preview.expiresAt,
    device: preview.kind === "device",
  };
}

/** Unirse: abre las claves que trae la invitación y las vuelve a ensobrar para uno mismo. */
/** Pide entrar a la casa: queda pendiente hasta que un admin lo apruebe. */
export async function acceptInvite(session: CloudSession, id: string, secret: string): Promise<string> {
  const secrets = await inviteSecrets(secret);
  const preview = await api<PreviewResponse>("POST", `/invites/${id}/preview`, { authToken: secrets.authToken });
  const envelopes = await envelopesFromInvite(id, secrets.wrapKey, preview, session.identity.encPublicKey, session.user.id);
  await api("POST", `/invites/${id}/accept`, { authToken: secrets.authToken, envelopes });
  return preview.householdId;
}

/** Abre las claves que trae la invitación y las vuelve a ensobrar para quien entra (más su Privado nuevo). */
async function envelopesFromInvite(id: string, wrapKey: CryptoKey, preview: PreviewResponse, encPublicKey: string, userId: string) {
  const carried = JSON.parse(preview.wrappedKeys) as Partial<Record<Scope, { version: number; key: string }>>;
  const envelopes = [];
  for (const scope of scopesFor(preview.role)) {
    const entry = carried[scope];
    const raw = scope === "private" ? newScopeKey() : entry ? await open(wrapKey, entry.key, inviteContext(id, scope)) : null;
    if (!raw) continue;
    const version = scope === "private" ? 1 : entry!.version;
    envelopes.push({ scope, version, envelope: await sealEnvelope(raw, encPublicKey, envelopeContext(preview.householdId, scope, version, userId)) });
  }
  return envelopes;
}

/** Entra con la llave del celular: el servidor manda un desafío y el celular lo firma. */
async function deviceSignIn(userId: string, deviceKey: CryptoKey) {
  const { challenge } = await api<{ challenge: string }>("POST", "/auth/device/challenge", { userId });
  await api("POST", "/auth/device/sign-in", { userId, challenge, signature: await signWithDevice(deviceKey, deviceSignInData(userId, challenge)) });
}

/**
 * Vincula este celular al perfil de un chico, con el código que mostró un adulto. Crea acá sus
 * claves y su llave para entrar (no se pueden exportar) y sube solo lo público: no hay email ni
 * contraseña. Como una invitación, queda esperando que un admin lo apruebe.
 */
export async function linkDevice(id: string, secret: string): Promise<CloudSession> {
  const secrets = await inviteSecrets(secret);
  const preview = await api<PreviewResponse>("POST", `/invites/${id}/preview`, { authToken: secrets.authToken });
  const { identity, deviceKey, devicePublicKey } = await createDeviceIdentity();
  const userId = crypto.randomUUID();
  const envelopes = await envelopesFromInvite(id, secrets.wrapKey, preview, identity.encPublicKey, userId);
  await api("POST", "/devices/link", { inviteId: id, authToken: secrets.authToken, userId, devicePublicKey, encPublicKey: identity.encPublicKey, signPublicKey: identity.signPublicKey, envelopes });
  // Sin otra cuenta abierta acá (la pantalla lo exige): lo que quedara en el llavero es viejo.
  await clearVault();
  // Primero se guarda la llave: si se corta acá, la próxima vez entra igual.
  await saveIdentity({ userId, email: "", identity, deviceKey, savedAt: Date.now() });
  await deviceSignIn(userId, deviceKey);
  return sessionFrom(await api<MeResponse>("GET", "/me"), identity);
}

/** Miembros actuales y los que se fueron (estos, para verificar sus cambios viejos). */
export function listRoster(householdId: string) {
  return api<{ members: CloudMember[]; former: FormerMember[] }>("GET", `/households/${householdId}/members`);
}

export function listMembers(householdId: string) {
  return listRoster(householdId).then((result) => result.members);
}

/**
 * Sacar a alguien de la casa: claves NUEVAS de los niveles que tenía (Familia siempre; Adultos si
 * no era chico), ensobradas para cada uno de los que quedan, y el nombre de la casa cifrado con la
 * Familia nueva. Lo que se escriba desde ahora, esa persona no lo puede abrir.
 */
export async function removeMember(household: CloudHousehold, member: CloudMember) {
  const remaining = (await listMembers(household.id)).filter((entry) => entry.userId !== member.userId);
  if (remaining.some((entry) => !entry.encPublicKey)) throw new CloudError("members-changed", 409);
  const scopes: Exclude<Scope, "private">[] = member.role === "kid" ? ["family"] : ["family", "adults"];
  let familyKey: CryptoKey | null = null;
  const rotation = [];
  for (const scope of scopes) {
    const raw = newScopeKey();
    const version = (scope === "family" ? household.familyKeyVersion : household.adultsKeyVersion) + 1;
    const recipients = remaining.filter((entry) => scopesFor(entry.role).includes(scope));
    const envelopes = await Promise.all(
      recipients.map(async (entry) => ({ userId: entry.userId, envelope: await sealEnvelope(raw, entry.encPublicKey!, envelopeContext(household.id, scope, version, entry.userId)) })),
    );
    rotation.push({ scope, version, envelopes });
    if (scope === "family") familyKey = await importScopeKey(raw);
  }
  const encryptedName = await seal(familyKey!, household.name, nameContext(household.id));
  await api("POST", `/households/${household.id}/members/${member.userId}/remove`, { encryptedName, rotation });
}

// --- Recuperación, contraseña, kit y dispositivos ------------------------------------------

/**
 * "Olvidé mi contraseña": el kit abre una copia de las claves, se vuelven a cifrar con la
 * contraseña nueva y se arma un kit nuevo (el usado deja de servir). Se cierran todas las sesiones.
 * Devuelve la sesión ya abierta en este dispositivo y el código del kit nuevo (se muestra una vez).
 */
export async function recoverAccount(input: { email: string; recoveryCode: string; password: string }): Promise<SignInResult & { recoveryCode: string }> {
  const email = input.email.trim();
  let recoveryAuth: string;
  try {
    recoveryAuth = await recoveryProof(input.recoveryCode);
  } catch {
    throw new ValidationError("errors.cloud.badKit");
  }
  const keys = await api<{ encPublicKey: string; signPublicKey: string; recoveryPrivateKeys: string }>("POST", "/recovery/start", { email, recoveryAuth });
  const fresh = await derivePasswordKeys(email, input.password);
  const recovered = await recoverIdentity(keys, input.recoveryCode, fresh.encKey);
  await api("POST", "/recovery/complete", {
    email,
    recoveryAuth,
    newPassword: fresh.authKey,
    privateKeys: recovered.privateKeys,
    recoveryPrivateKeys: recovered.kit.recoveryPrivateKeys,
    recoveryVerifier: recovered.kit.recoveryVerifier,
  });
  // El kit cambia la contraseña, no apaga los dos pasos: si están encendidos, falta el código.
  const signedIn = await api<{ twoFactorRedirect?: boolean }>("POST", "/auth/sign-in/email", { email, password: fresh.authKey });
  const finish = async () => sessionFrom(await api<MeResponse>("GET", "/me"), recovered.identity);
  const recoveryCode = recovered.kit.recoveryCode;
  return signedIn?.twoFactorRedirect ? { secondStep: { finish }, recoveryCode } : { session: await finish(), recoveryCode };
}

/** Cambiar la contraseña sabiendo la actual: mismas claves, cifradas con la nueva. Cierra las otras sesiones. */
export async function changePassword(session: CloudSession, input: { current: string; next: string }) {
  const [current, next] = await Promise.all([derivePasswordKeys(session.user.email, input.current), derivePasswordKeys(session.user.email, input.next)]);
  const me = await api<MeResponse>("GET", "/me");
  let privateKeys: string;
  try {
    privateKeys = await rewrapIdentity(me.keys!.privateKeys, current.encKey, next.encKey);
  } catch {
    throw new CloudError("wrong-password", 403);
  }
  await api("POST", "/account/password", { currentPassword: current.authKey, newPassword: next.authKey, privateKeys });
}

/** Un kit de recuperación nuevo (el anterior deja de servir). Devuelve el código para mostrarlo una vez. */
export async function regenerateRecoveryKit(session: CloudSession, password: string): Promise<string> {
  const keys = await derivePasswordKeys(session.user.email, password);
  const me = await api<MeResponse>("GET", "/me");
  let kit;
  try {
    kit = await newRecoveryKit(me.keys!.privateKeys, keys.encKey);
  } catch {
    throw new CloudError("wrong-password", 403);
  }
  await api("POST", "/account/recovery-kit", { password: keys.authKey, recoveryPrivateKeys: kit.recoveryPrivateKeys, recoveryVerifier: kit.recoveryVerifier });
  return kit.recoveryCode;
}

// --- Verificación en dos pasos y llaves de acceso ------------------------------------------

/**
 * Encender: con la contraseña, el servidor arma el secreto de la app autenticadora (para el QR) y
 * diez códigos de respaldo. Queda apagado hasta confirmar el primer código (`confirmTwoFactor`).
 */
export async function startTwoFactor(session: CloudSession, password: string): Promise<{ totpURI: string; backupCodes: string[] }> {
  const keys = await derivePasswordKeys(session.user.email, password);
  return api("POST", "/auth/two-factor/enable", { password: keys.authKey, issuer: "Refugiar" });
}

export async function confirmTwoFactor(code: string) {
  await api("POST", "/auth/two-factor/verify-totp", { code: code.trim() });
}

/** Apagar (borra también las llaves de acceso: solo servían como segundo paso). */
export async function disableTwoFactor(session: CloudSession, password: string) {
  const keys = await derivePasswordKeys(session.user.email, password);
  await api("POST", "/auth/two-factor/disable", { password: keys.authKey });
}

/** Diez códigos de respaldo nuevos; los anteriores dejan de servir. */
export async function newBackupCodes(session: CloudSession, password: string): Promise<string[]> {
  const keys = await derivePasswordKeys(session.user.email, password);
  return (await api<{ backupCodes: string[] }>("POST", "/auth/two-factor/generate-backup-codes", { password: keys.authKey })).backupCodes;
}

export async function listPasskeys(): Promise<CloudPasskey[]> {
  return (await api<{ passkeys: CloudPasskey[] }>("GET", "/account/passkeys")).passkeys;
}

/**
 * Suma una llave de acceso de este dispositivo (o de una llave física). Pide la contraseña. Si el
 * dispositivo da el secreto de la llave (PRF), guarda una copia de las claves cifrada con él: desde
 * ahí la llave entra sola. Si no, la llave queda como segundo paso (sin los dos pasos encendidos
 * no serviría, así que se quita).
 */
export async function addPasskey(session: CloudSession, input: { name?: string; password: string }): Promise<{ unlocks: boolean }> {
  const keys = await derivePasswordKeys(session.user.email, input.password);
  const me = await api<MeResponse>("GET", "/me");
  // Antes de pedir la huella: la contraseña tiene que abrir las claves.
  try {
    await unlockIdentity(me.keys!, keys.encKey);
  } catch {
    throw new CloudError("wrong-password", 403);
  }
  const optionsJSON = await api<PublicKeyCredentialCreationOptionsJSON>("GET", "/auth/passkey/generate-register-options");
  const response = await startRegistration({ optionsJSON: withPrf(optionsJSON) }).catch(() => {
    throw new CloudError("passkey-cancelled", 0);
  });
  const created = takePrf(response);
  const passkey = await api<{ id: string; credentialID: string }>("POST", "/auth/passkey/verify-registration", { response, name: (input.name ?? "").trim() || undefined, password: keys.authKey });
  const prf = created ?? (await evaluatePrf(passkey.credentialID));
  if (prf) {
    const privateKeys = await wrapForPasskey(me.keys!.privateKeys, keys.encKey, prf, passkey.credentialID);
    await api("POST", `/account/passkeys/${passkey.id}/unlock`, { password: keys.authKey, privateKeys });
    return { unlocks: true };
  }
  if (!session.user.twoFactorEnabled) {
    await removePasskey(passkey.id);
    throw new CloudError("passkey-no-prf", 0);
  }
  return { unlocks: false };
}

export async function removePasskey(id: string) {
  await api("POST", "/auth/passkey/delete-passkey", { id });
}

/**
 * Las casas que frenan el borrado de la cuenta: las que administra sola y donde hay más gente.
 * Primero tiene que pasarle la administración a alguien (el servidor lo vuelve a comprobar).
 */
export async function householdsBlockingDeletion(session: CloudSession): Promise<CloudHousehold[]> {
  const admin = session.households.filter((household) => household.role === "admin");
  const rosters = await Promise.all(admin.map((household) => listMembers(household.id)));
  return admin.filter((_, index) => rosters[index].length > 1 && rosters[index].filter((member) => member.role === "admin").length <= 1);
}

/** Borra la cuenta, las casas donde vive sola y su lugar en las compartidas. Ver `/api/account/delete`. */
export async function deleteAccount(email: string) {
  await api("POST", "/account/delete", { confirm: email.trim().toLowerCase() });
  await clearVault();
}

export function listDevices() {
  return api<{ devices: CloudDevice[] }>("GET", "/account/devices").then((result) => result.devices);
}

export function revokeDevice(id: string) {
  return api("DELETE", `/account/devices/${id}`);
}

export function listInvites(householdId: string) {
  return api<{ invites: CloudInvite[] }>("GET", `/households/${householdId}/invites`).then((result) => result.invites);
}

export function revokeInvite(householdId: string, inviteId: string) {
  return api("DELETE", `/households/${householdId}/invites/${inviteId}`);
}

export function listJoinRequests(householdId: string) {
  return api<{ requests: JoinRequest[] }>("GET", `/households/${householdId}/join-requests`).then((result) => result.requests);
}

export function approveJoinRequest(householdId: string, requestId: string) {
  return api("POST", `/households/${householdId}/join-requests/${requestId}/approve`, {});
}

export function rejectJoinRequest(householdId: string, requestId: string) {
  return api("DELETE", `/households/${householdId}/join-requests/${requestId}`);
}

/**
 * Cambiar el rol. Si alguien pasa a poder ver "Adultos", quien hace el cambio le entrega esa
 * clave (ensobrada para él). Si pasa a chico, la clave de Adultos se rota para los que quedan.
 */
export async function changeRole(session: CloudSession, household: CloudHousehold, member: CloudMember, role: CloudRole) {
  if (role === "kid" && member.role !== "kid") {
    // Deja de ver "Adultos": como ya tenía esa clave, se rota para los adultos que quedan.
    const adults = (await listMembers(household.id)).filter((entry) => entry.userId !== member.userId && entry.role !== "kid");
    const raw = newScopeKey();
    const version = household.adultsKeyVersion + 1;
    const envelopes = await Promise.all(
      adults.map(async (entry) => ({ userId: entry.userId, envelope: await sealEnvelope(raw, entry.encPublicKey!, envelopeContext(household.id, "adults", version, entry.userId)) })),
    );
    await api("PATCH", `/households/${household.id}/members/${member.userId}`, { role, rotation: { version, envelopes } });
    return;
  }
  await api("PATCH", `/households/${household.id}/members/${member.userId}`, { role });
  if (role !== "kid" && member.role === "kid" && member.encPublicKey) {
    const { raw } = await openScopeKey(session.identity, session.user.id, household, "adults");
    const version = household.adultsKeyVersion;
    await api("POST", `/households/${household.id}/envelopes`, {
      recipientUserId: member.userId,
      envelopes: [{ scope: "adults", version, envelope: await sealEnvelope(raw, member.encPublicKey, envelopeContext(household.id, "adults", version, member.userId)) }],
    });
  }
}
