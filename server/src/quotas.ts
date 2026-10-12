/**
 * Topes por casa en la nube. La capa gratuita es de toda la cuenta (Durable Objects, D1 y el bucket
 * de fotos): sin topes, un dispositivo con un error que sube en bucle, o alguien que abuse, la agota
 * para todas las familias a la vez. Una familia común no se acerca: cada operación agrupa hasta 200
 * ediciones, y subir una casa entera son unas decenas.
 */
export const HOUSEHOLD_QUOTAS = {
  /** Operaciones nuevas por día (UTC). */
  opsPerDay: 2_000,
  /** Tamaño del registro de cambios cifrados de la casa. */
  logBytes: 100 * 1024 * 1024,
  /** Fotos cifradas de la casa (completas y miniaturas). */
  photoBytes: 100 * 1024 * 1024,
} as const;

/** La casa llegó a un tope (el error cruza la llamada al Durable Object por su mensaje). */
export const QUOTA_EXCEEDED = "sync-quota";

/** El servidor de casa los apaga (`HOUSEHOLD_QUOTAS=off`): el disco es de la familia. */
export const quotasOn = (env: { HOUSEHOLD_QUOTAS?: string }) => env.HOUSEHOLD_QUOTAS !== "off";
