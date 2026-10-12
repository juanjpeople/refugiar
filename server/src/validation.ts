/**
 * Validación de todo lo que entra. El servidor no puede leer lo cifrado, pero sí exige que tenga
 * la forma correcta y un tamaño razonable (nada de blobs gigantes ni campos de más).
 */
import { z } from "zod";
import { SYNC_LIMITS } from "../../src/lib/sync/protocol";

/** base64url sin relleno. */
const b64 = (max: number) => z.string().min(16).max(max).regex(/^[A-Za-z0-9_-]+$/);
/** Caja cifrada: `iv.ciphertext` en base64url (ver `src/lib/crypto` en la app). */
export const box = (max = 4_096) => z.string().min(24).max(max).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
/** Sobre: `clavePúblicaEfímera.iv.ciphertext` en base64url. */
export const envelope = z.string().min(48).max(1_024).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

export const ROLES = ["admin", "adult", "kid"] as const;
export type Role = (typeof ROLES)[number];
export const SCOPES = ["family", "adults", "private"] as const;
export type Scope = (typeof SCOPES)[number];

export const uuid = z.string().uuid();
/** Ids de usuario de Better Auth (no son UUID). */
export const userId = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const userKeysInput = z.object({
  kdfVersion: z.literal(1),
  encPublicKey: b64(64),
  signPublicKey: b64(64),
  privateKeys: box(),
  recoveryPrivateKeys: box(),
  /** Hash de la prueba de que se tiene el kit (la prueba sale del código, en el dispositivo). */
  recoveryVerifier: b64(64),
});

/** La "contraseña" que recibe el servidor: la clave de autenticación derivada (32 bytes en base64url). */
const authKey = z.string().length(43).regex(/^[A-Za-z0-9_-]+$/);
const email = z.string().trim().toLowerCase().email().max(254);

export const recoveryStartInput = z.object({ email, recoveryAuth: b64(64) });

/** Recuperar = contraseña nueva + claves re-cifradas con ella + un kit nuevo (el usado se descarta). */
export const recoveryCompleteInput = recoveryStartInput.extend({
  newPassword: authKey,
  privateKeys: box(),
  recoveryPrivateKeys: box(),
  recoveryVerifier: b64(64),
});

export const changePasswordInput = z.object({ currentPassword: authKey, newPassword: authKey, privateKeys: box() });

export const recoveryKitInput = z.object({ password: authKey, recoveryPrivateKeys: box(), recoveryVerifier: b64(64) });

/** La copia de las claves privadas que abre una llave de acceso (cifrada en el dispositivo con su PRF). */
export const passkeyUnlockInput = z.object({ password: authKey, privateKeys: box() });

/** Sacar a alguien: claves nuevas de los niveles que tenía, para cada uno de los que quedan. */
export const removeMemberInput = z.object({
  encryptedName: box(1_024),
  rotation: z
    .array(
      z.object({
        scope: z.enum(["family", "adults"]),
        version: z.number().int().min(2).max(1_000_000),
        envelopes: z.array(z.object({ userId, envelope })).min(1).max(100),
      }),
    )
    .min(1)
    .max(2),
});

export const envelopeInput = z.object({
  scope: z.enum(SCOPES),
  version: z.number().int().min(1).max(1_000_000),
  envelope,
});

/** Código de licencia, como lo escribe la persona (con o sin guiones, en minúscula o mayúscula). */
export const licenseCode = z.string().trim().min(8).max(64);

export const createHouseholdInput = z.object({
  id: uuid,
  encryptedName: box(1_024),
  envelopes: z.array(envelopeInput).min(1).max(3),
  /** La licencia que habilita la casa en la nube (no hace falta con `HOUSEHOLD_ACCESS=open`). */
  accessCode: licenseCode.optional(),
});

export const licenseCheckInput = z.object({ code: licenseCode });

/**
 * Nube cerrada: con qué se crea una cuenta. Una licencia vigente (no se consume: se consume al
 * crear la casa) o una invitación para una cuenta, sin usar y sin vencer.
 */
export const signUpAccessInput = z.union([
  z.object({ code: licenseCode }),
  z.object({ invite: z.object({ id: uuid, authToken: b64(64) }) }),
]);

/** Administración: emitir licencias (a mano hoy; mañana, el webhook del cobro). */
export const createLicensesInput = z.object({
  count: z.number().int().min(1).max(50).default(1),
  plan: z.string().regex(/^[a-z][a-z0-9-]{1,23}$/).default("beta"),
  maxHouseholds: z.number().int().min(1).max(10).default(1),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
  source: z.string().regex(/^[a-z][a-z0-9-]{1,23}$/).default("manual"),
  externalId: z.string().max(128).optional(),
  note: z.string().trim().max(120).optional(),
});

/** Anotarse en la lista de espera de la nube (sin cuenta). */
export const waitlistInput = z.object({ name: z.string().trim().min(1).max(60), email });

/** Habilitar de la lista de espera, de a tandas. */
export const waitlistEnableInput = z.object({ ids: z.array(uuid).min(1).max(50) });

const MB = 1024 * 1024;
const opsPerDay = z.number().int().min(10).max(1_000_000);
const logBytes = z.number().int().min(MB).max(10 * 1024 * MB);
const photoBytes = z.number().int().min(MB).max(100 * 1024 * MB);

/** Los topes de todas las casas (ver server/src/quotas.ts). */
export const quotaDefaultsInput = z.object({ opsPerDay, logBytes, photoBytes });

/** El tope propio de una casa. `null` vuelve al de todas. */
export const householdQuotaInput = z.object({ opsPerDay: opsPerDay.nullable(), logBytes: logBytes.nullable(), photoBytes: photoBytes.nullable() });

export const feedbackInput = z.object({
  category: z.enum(["idea", "problem", "question", "other"]),
  message: z.string().trim().min(10).max(2_000),
  email: email.optional(),
});

export const feedbackStatusInput = z.object({ status: z.enum(["open", "resolved"]) });

export const deleteHouseholdInput = z.object({ confirm: uuid });

/** Borrar una cuenta desde el panel: se confirma con su email. */
export const deleteUserInput = z.object({ confirm: email });

export const inactivityNoticeStatusInput = z.object({ status: z.enum(["sent", "cancelled"]) });

export const createInviteInput = z.object({
  id: uuid,
  role: z.enum(ROLES),
  tokenHash: b64(64),
  /** JSON con las claves de la casa cifradas con la clave del link (el servidor no lo interpreta). */
  wrappedKeys: z.string().min(24).max(8_192),
  expiresInDays: z.number().int().min(1).max(30).default(7),
  /** `device`: el código para vincular el celular de un chico (solo rol chico, vence en minutos). */
  kind: z.enum(["account", "device"]).default("account"),
});

export const inviteTokenInput = z.object({ authToken: b64(64) });

/**
 * Vincular el celular de un chico: con el código, sube las claves públicas que creó el celular
 * (cifrar, firmar y entrar) y sus sobres de la casa. No hay email ni contraseña.
 */
export const deviceLinkInput = z.object({
  inviteId: uuid,
  /** El id lo elige el celular: sus sobres de la casa van atados a él desde antes de existir la cuenta. */
  userId: uuid,
  authToken: b64(64),
  /** Llave para entrar: ECDSA P-256 (SPKI, 91 bytes). */
  devicePublicKey: b64(160),
  encPublicKey: b64(64),
  signPublicKey: b64(64),
  envelopes: z.array(envelopeInput).min(1).max(3),
});

export const acceptInviteInput = z.object({
  authToken: b64(64),
  envelopes: z.array(envelopeInput).min(1).max(3),
});

/** Al pasar a alguien a chico, la clave de Adultos nueva, ensobrada para los adultos que quedan. */
export const changeRoleInput = z.object({
  role: z.enum(ROLES),
  rotation: z
    .object({
      version: z.number().int().min(2).max(1_000_000),
      envelopes: z.array(z.object({ userId, envelope })).min(1).max(100),
    })
    .optional(),
});

// --- Sincronización ---------------------------------------------------------------------------

/** Firma Ed25519: 64 bytes en base64url. */
const signature = z.string().length(86).regex(/^[A-Za-z0-9_-]+$/);

export const wireOp = z.object({
  id: uuid,
  scope: z.enum(SCOPES),
  keyVersion: z.number().int().min(1).max(1_000_000),
  body: box(SYNC_LIMITS.opBodyChars),
  sig: signature,
});

export const pushInput = z.object({ ops: z.array(wireOp).min(1).max(SYNC_LIMITS.opsPerPush) });

export const pullQuery = z.object({
  since: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  limit: z.coerce.number().int().min(1).max(SYNC_LIMITS.pullOps).default(SYNC_LIMITS.pullOps),
});
