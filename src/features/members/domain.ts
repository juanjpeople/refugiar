/**
 * Miembros de la casa: quiénes viven acá, su rol y cómo protegen su perfil.
 * Sin React ni base de datos.
 */
import { isAppearanceColor, type AppearanceColor } from "@/lib/appearance";
import { ROLES, type Role } from "@/lib/auth/permissions";
import { ValidationError } from "@/lib/errors";

/** PIN derivado con PBKDF2: nunca se guarda el PIN, solo la sal y el resultado. */
export interface PinHash {
  hash: string;
  salt: string;
  iterations: number;
}

/** Credencial biométrica (WebAuthn) registrada en un dispositivo. */
export interface BiometricCredential {
  /** `native`: de la app de Android anterior, con la clave en su Keystore. El navegador las ignora. */
  kind?: "native";
  /** Id de la credencial (base64url). */
  id: string;
  /** Clave pública SPKI (base64): con ella se verifica cada desbloqueo. */
  publicKey: string;
  /** Algoritmo COSE: -7 (ES256) o -257 (RS256). */
  algorithm: number;
  /** "Chrome en Windows", "Safari en iPhone"… */
  label: string;
  createdAt: number;
}

export interface Member {
  id: string;
  name: string;
  role: Role;
  color: AppearanceColor;
  /** Cuenta de la nube de esta persona. Sin cuenta: perfil de un dispositivo compartido (ej. un chico con PIN). */
  userId?: string;
  /** Un emoji como avatar (opcional; si no, la inicial). */
  emoji?: string;
  /** "YYYY-MM-DD" (el año puede faltar: "--MM-DD"). Alimenta los cumpleaños del calendario. */
  birthday?: string;
  pin?: PinHash;
  credentials?: BiometricCredential[];
  createdAt: number;
  updatedAt: number;
}

export type MemberInput = Pick<Member, "name" | "role" | "color" | "emoji" | "birthday">;

export const MEMBER_LIMITS = { nameMaxLength: 40, pinMin: 4, pinMax: 8 } as const;

/** Miembros con los que arranca una casa (mismos ids que los perfiles fijos de antes). */
export const DEFAULT_MEMBERS: Omit<Member, "createdAt" | "updatedAt">[] = [
  { id: "profile-admin", name: "Administrador", role: "admin", color: "blue" },
  { id: "profile-adult", name: "Adulto", role: "adult", color: "green" },
  { id: "profile-kid", name: "Explorador", role: "kid", color: "orange" },
];

/**
 * Qué perfiles se pueden elegir en este dispositivo. Con la casa en la nube (`accountUserId`), el
 * propio y los que no tienen cuenta (un chico con PIN en la tablet); el de otra cuenta, no: ese
 * perfil es de esa persona y se usa desde sus dispositivos (si no, Flor podría "ser Juan").
 * En el celular de un chico (`onlyOwn`), solo el suyo: no puede pasarse al perfil de un adulto.
 */
export function pickableProfiles<T extends Pick<Member, "userId">>(members: T[], accountUserId: string | null, onlyOwn = false): T[] {
  if (!accountUserId) return members;
  return members.filter((member) => member.userId === accountUserId || (!onlyOwn && !member.userId));
}

/** Un perfil está protegido si tiene PIN o biometría. */
export function isSecured(member: Pick<Member, "pin" | "credentials">): boolean {
  return !!member.pin || (member.credentials?.length ?? 0) > 0;
}

/**
 * Grandes que pueden desbloquear por otro: los que tienen PIN o huella en este dispositivo.
 * `profiles`: los perfiles que se pueden elegir acá (ver `pickableProfiles`).
 */
export function guardians<T extends Pick<Member, "role" | "pin" | "credentials">>(profiles: T[]): T[] {
  return profiles.filter((member) => member.role !== "kid" && isSecured(member));
}

/**
 * Un chico entra a su perfil solo si algún grande de este dispositivo tiene PIN o huella. Si no,
 * desde su perfil podría pasar a uno de grande sin que nadie se entere (ver docs/CHICOS.md). En el
 * celular propio de un chico no hay perfiles de grandes para elegir: ahí entra siempre.
 */
export function canEnterKid(profiles: Pick<Member, "role" | "pin" | "credentials">[]): boolean {
  return !profiles.some((profile) => profile.role !== "kid") || guardians(profiles).length > 0;
}

/**
 * Si entrar a este perfil pide desbloqueo. Con PIN o huella propios, siempre. Un grande sin PIN, si
 * en este dispositivo hay chicos y algún grande protegido: lo desbloquea ese grande.
 */
export function needsUnlock(member: Pick<Member, "role" | "pin" | "credentials">, profiles: Pick<Member, "role" | "pin" | "credentials">[]): boolean {
  if (isSecured(member)) return true;
  return member.role !== "kid" && profiles.some((profile) => profile.role === "kid") && canEnterKid(profiles);
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${MEMBER_LIMITS.pinMin},${MEMBER_LIMITS.pinMax}}$`).test(pin);
}

/** Un solo emoji (o vacío): evita que un "avatar" sea un texto largo. */
function parseEmoji(value: string | undefined): string | undefined {
  const emoji = value?.trim();
  if (!emoji) return undefined;
  const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(emoji)];
  if (segments.length !== 1 || !/\p{Extended_Pictographic}/u.test(emoji)) throw new ValidationError("errors.validation.emojiInvalid");
  return emoji;
}

function parseBirthday(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!/^(\d{4}|--)-\d{2}-\d{2}$/.test(value)) throw new ValidationError("errors.validation.dateInvalid");
  return value;
}

export function parseMember(input: MemberInput): MemberInput {
  const name = input.name?.trim() ?? "";
  if (!name) throw new ValidationError("errors.validation.nameRequired");
  if (name.length > MEMBER_LIMITS.nameMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: MEMBER_LIMITS.nameMaxLength });
  if (!ROLES.includes(input.role)) throw new ValidationError("errors.validation.kindInvalid");
  if (!isAppearanceColor(input.color)) throw new ValidationError("errors.validation.appearanceInvalid");
  return { name, role: input.role, color: input.color, emoji: parseEmoji(input.emoji), birthday: parseBirthday(input.birthday) };
}
