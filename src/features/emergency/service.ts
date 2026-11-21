/**
 * Servicio de Emergencias: ÚNICO punto que escribe sus fichas (en `houseSettings`). Lo edita
 * quien organiza la casa; cualquiera de la casa lo puede leer. No va al historial: las fichas
 * médicas y los contactos no tienen por qué aparecer en "Qué pasó".
 */
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { deletePhoto } from "@/features/media/service";
import {
  EMERGENCY_LIMITS,
  emergencyId,
  isEmergencyRecord,
  validateCard,
  validateContact,
  validateDocument,
  validatePlace,
  validatePlan,
  validateRadio,
  validateShutoff,
  type EmergencyId,
  type EmergencyInput,
  type EmergencyRecord,
  type EmergencySection,
} from "./domain";

type Of<S extends EmergencySection> = Extract<EmergencyRecord, { section: S }>;

const VALIDATE: { [S in EmergencySection]: (input: EmergencyInput<Of<S>>) => EmergencyInput<Of<S>> } = {
  contact: validateContact,
  card: validateCard,
  plan: validatePlan,
  place: validatePlace,
  radio: validateRadio,
  shutoff: validateShutoff,
  doc: validateDocument,
};

/**
 * Crea o reemplaza una ficha. `id`: la existente (o, para fichas médicas y el plan, el id fijo).
 * Sin `id`, una nueva. Devuelve el id guardado.
 */
export async function saveEmergency<S extends EmergencySection>(actor: Actor | null, section: S, input: EmergencyInput<Of<S>>, id?: EmergencyId): Promise<EmergencyId> {
  assertCan(actor, "calendar.manage");
  const data = VALIDATE[section](input);
  const target = id ?? emergencyId(section, createId());
  if (!target.startsWith(`emergency:${section}:`)) throw new ValidationError("errors.validation.kindInvalid");
  await db.transaction("rw", db.houseSettings, async () => {
    if (!id) {
      const count = await db.houseSettings.where("id").startsWith(`emergency:${section}:`).count();
      if (count >= EMERGENCY_LIMITS.perSection) throw new ValidationError("emergency.errors.limit", { max: EMERGENCY_LIMITS.perSection });
    }
    await db.houseSettings.put({ ...data, id: target, kind: "emergency", section, updatedAt: Date.now() } as EmergencyRecord);
  });
  return target;
}

/** Varios lugares de una (los elegidos de "Buscar cerca"). */
export async function savePlaces(actor: Actor | null, places: EmergencyInput<Of<"place">>[]): Promise<number> {
  assertCan(actor, "calendar.manage");
  const data = places.map(validatePlace);
  await db.transaction("rw", db.houseSettings, async () => {
    const count = await db.houseSettings.where("id").startsWith("emergency:place:").count();
    if (count + data.length > EMERGENCY_LIMITS.perSection) throw new ValidationError("emergency.errors.limit", { max: EMERGENCY_LIMITS.perSection });
    const now = Date.now();
    await db.houseSettings.bulkPut(data.map((place) => ({ ...place, id: emergencyId("place", createId()), kind: "emergency" as const, section: "place" as const, updatedAt: now })));
  });
  return data.length;
}

export async function deleteEmergency(actor: Actor | null, id: EmergencyId): Promise<void> {
  assertCan(actor, "calendar.manage");
  const existing = await db.houseSettings.get(id);
  if (!isEmergencyRecord(existing)) throw new NotFoundError("errors.notFound.item");
  // Un documento se lleva sus fotos (y sus copias cifradas en la nube).
  if (existing.section === "doc") {
    const photos = await db.photos.where("[ownerType+ownerId]").equals(["emergency", id]).toArray();
    for (const photo of photos) await deletePhoto(actor, photo.id);
  }
  await db.houseSettings.delete(id);
}
