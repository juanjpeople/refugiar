/**
 * Diagnóstico para soporte: lo justo para entender un problema de sincronización, sin nada de la
 * persona ni de la casa (ni nombres, ni emails, ni contenido). Se copia y se manda a mano.
 */
import { BRAND } from "@/config/brand";
import { APP_VERSION } from "@/features/settings/service";
import { describeUserAgent, deviceLabel } from "@/lib/device";
import { isAndroidApp } from "@/lib/platform";
import { getSyncLink } from "@/lib/sync/middleware";
import type { SyncErrorCode, SyncPhase } from "@/lib/sync/status";

/** Pide que el navegador no borre los datos de la app si le falta espacio (instalada, Chrome lo concede). */
export async function persistStorage(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/**
 * Si el navegador prometió no borrar los datos. En la app de Android la pregunta no aplica
 * (`null`): el almacenamiento es de la app y el remedio que se sugiere, instalarla, ya está hecho.
 */
export async function isStoragePersisted(): Promise<boolean | null> {
  if (isAndroidApp()) return null;
  try {
    return (await navigator.storage?.persisted?.()) ?? null;
  } catch {
    return null;
  }
}

export interface SyncSnapshot {
  phase: SyncPhase;
  error: SyncErrorCode | null;
  pending: number;
  lastSyncAt: number | null;
  rejected: number;
}

export async function diagnosticText(mode: string, sync: SyncSnapshot): Promise<string> {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const { mobile } = describeUserAgent(ua);
  const android = isAndroidApp();
  const standalone = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;
  const persisted = await isStoragePersisted();
  const link = getSyncLink();
  return [
    `${BRAND.name} ${APP_VERSION}`,
    `Dispositivo: ${deviceLabel(ua) || "?"}${mobile ? " (celular)" : ""}${android ? " · app Android" : standalone ? " · app instalada" : ""}`,
    `En línea: ${typeof navigator !== "undefined" && navigator.onLine ? "sí" : "no"}`,
    `Modo: ${mode}`,
    `Sincronización: ${sync.phase}${sync.error ? ` (${sync.error})` : ""} · pendientes ${sync.pending} · descartados ${sync.rejected}`,
    `Última vez: ${sync.lastSyncAt ? new Date(sync.lastSyncAt).toISOString() : "nunca"}`,
    `Datos persistentes: ${android ? "no aplica (app Android)" : persisted === null ? "?" : persisted ? "sí" : "no"}`,
    // Solo el comienzo del id (al azar): alcanza para encontrar la casa en los registros.
    `Casa: ${link ? `${link.householdId.slice(0, 8)}… · dispositivo ${link.deviceId.slice(0, 8)}…` : "—"}`,
  ].join("\n");
}
