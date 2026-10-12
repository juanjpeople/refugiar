/**
 * Topes por casa en la nube. La capa gratuita es de toda la cuenta (Durable Objects, D1 y el bucket
 * de fotos): sin topes, un dispositivo con un error que sube en bucle, o alguien que abuse, la agota
 * para todas las familias a la vez. Una familia común no se acerca: cada operación agrupa hasta 200
 * ediciones, y subir una casa entera son unas decenas.
 *
 * El operador los cambia desde /admin sin deploy: los de todas las casas y uno propio por casa. Si
 * contrata un plan, los sube ahí. Nunca se pasan solos a consumo pago: llegar a un tope frena.
 */
export interface Quotas {
  /** Operaciones nuevas por día (UTC). */
  opsPerDay: number;
  /** Tamaño del registro de cambios cifrados de la casa. */
  logBytes: number;
  /** Fotos cifradas de la casa (completas y miniaturas). */
  photoBytes: number;
}

export type QuotaKind = "ops" | "log" | "photos";

const MB = 1024 * 1024;

/** Los del código: rigen mientras el operador no fije otros. */
export const HOUSEHOLD_QUOTAS: Quotas = { opsPerDay: 2_000, logBytes: 100 * MB, photoBytes: 100 * MB };

/** Capa gratuita del proveedor de fotos (Supabase Free: 1 GB de archivos), para verla en Capacidad. */
export const PHOTO_FREE_BYTES = 1024 * MB;

/** La casa llegó a un tope (el error cruza la llamada al Durable Object por su mensaje). */
export const QUOTA_EXCEEDED = "sync-quota";

export const quotaError = (kind: QuotaKind) => new Error(`${QUOTA_EXCEEDED}:${kind}`);

/** Qué tope saltó, si el error es por un tope. */
export function quotaKind(error: unknown): QuotaKind | null {
  if (!(error instanceof Error) || !error.message.startsWith(`${QUOTA_EXCEEDED}:`)) return null;
  const kind = error.message.slice(QUOTA_EXCEEDED.length + 1);
  return kind === "ops" || kind === "log" || kind === "photos" ? kind : null;
}

/** El servidor de casa los apaga (`HOUSEHOLD_QUOTAS=off`): el disco es de la familia. */
export const quotasOn = (env: { HOUSEHOLD_QUOTAS?: string }) => env.HOUSEHOLD_QUOTAS !== "off";

type QuotaRow = { ops: number | null; log: number | null; photos: number | null };

/** Los de todas las casas: los que fijó el operador o, si no fijó ninguno, los del código. */
export async function defaultQuotas(db: D1Database): Promise<Quotas> {
  const row = await db.prepare("select ops_per_day as ops, log_bytes as log, photo_bytes as photos from quota_defaults where id = 1").first<QuotaRow>();
  return { opsPerDay: row?.ops ?? HOUSEHOLD_QUOTAS.opsPerDay, logBytes: row?.log ?? HOUSEHOLD_QUOTAS.logBytes, photoBytes: row?.photos ?? HOUSEHOLD_QUOTAS.photoBytes };
}

/** Los que rigen para una casa: el suyo, el de todas o el del código, en ese orden. */
export async function householdQuotas(db: D1Database, householdId: string): Promise<Quotas> {
  const row = await db
    .prepare(
      `select coalesce(q.ops_per_day, d.ops_per_day) as ops, coalesce(q.log_bytes, d.log_bytes) as log, coalesce(q.photo_bytes, d.photo_bytes) as photos
         from (select 1) left join quota_defaults d on d.id = 1 left join household_quotas q on q.household_id = ?`,
    )
    .bind(householdId)
    .first<QuotaRow>();
  return { opsPerDay: row?.ops ?? HOUSEHOLD_QUOTAS.opsPerDay, logBytes: row?.log ?? HOUSEHOLD_QUOTAS.logBytes, photoBytes: row?.photos ?? HOUSEHOLD_QUOTAS.photoBytes };
}

/** Anota que la casa llegó a un tope (una vez por hora y por tope, para no escribir en cada intento). */
export async function recordQuotaHit(db: D1Database, householdId: string, kind: QuotaKind, now = Date.now()) {
  await db
    .prepare("insert into quota_hits (household_id, kind, at) values (?, ?, ?) on conflict (household_id, kind) do update set at = excluded.at where quota_hits.at < ?")
    .bind(householdId, kind, now, now - 3_600_000)
    .run();
}
