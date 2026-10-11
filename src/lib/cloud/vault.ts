/**
 * Llavero del dispositivo: la identidad de la persona (claves privadas) en IndexedDB, como
 * CryptoKey NO exportables. Se pueden usar para abrir sobres y firmar, pero ningún script
 * puede leerlas ni mandarlas a otro lado. Así un dispositivo de confianza no pide la
 * contraseña cada vez. "Salir" lo borra.
 *
 * Las claves de nivel (Familia, Adultos…) no se guardan acá: se abren de sus sobres cuando
 * hacen falta, con esta identidad.
 */
import Dexie, { type EntityTable } from "dexie";
import type { Identity } from "@/lib/crypto";

export interface VaultEntry {
  userId: string;
  email: string;
  identity: Identity;
  /** Solo en el celular de un chico: su llave para entrar (no exportable). Sin ella, hay que volver a vincularlo. */
  deviceKey?: CryptoKey;
  savedAt: number;
}

const vault = new Dexie("RefugiarVault") as Dexie & { identities: EntityTable<VaultEntry, "userId"> };
vault.version(1).stores({ identities: "userId" });

/** Guarda la identidad. Si ya había una llave del celular para esa cuenta, la conserva. */
export async function saveIdentity(entry: VaultEntry) {
  const existing = await vault.identities.get(entry.userId);
  await vault.identities.put({ deviceKey: existing?.deviceKey, ...entry });
}

/** La cuenta del celular de un chico guardada en este dispositivo (entra con su llave, sin contraseña). */
export async function loadDeviceAccount(): Promise<(VaultEntry & { deviceKey: CryptoKey }) | undefined> {
  const entries = await vault.identities.toArray();
  return entries.find((entry): entry is VaultEntry & { deviceKey: CryptoKey } => Boolean(entry.deviceKey));
}

export async function loadIdentity(userId: string): Promise<VaultEntry | undefined> {
  return vault.identities.get(userId);
}

export async function clearVault() {
  await vault.identities.clear();
}
