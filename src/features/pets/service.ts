/**
 * Servicio de mascotas: gestión de fichas, libreta sanitaria y recordatorios.
 */
import { recordActivity } from "@/features/activity/service";
import { createEvent } from "@/features/calendar/service";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import {
  isPetProfile,
  petProfileId,
  validatePetProfile,
  type PetProfile,
  type PetProfileId,
  type PetProfileInput,
} from "./domain";

export async function savePetProfile(
  actor: Actor | null,
  id: string,
  input: PetProfileInput,
): Promise<PetProfileId> {
  assertCan(actor, "calendar.manage");
  const data = validatePetProfile(input);
  const pid = petProfileId(id);

  await db.transaction("rw", db.houseSettings, db.activity, async () => {
    const existing = await db.houseSettings.get(pid);
    const isNew = !existing;

    const profile: PetProfile = {
      ...data,
      id: pid,
      kind: "pet",
      updatedAt: Date.now(),
    };

    await db.houseSettings.put(profile);
    await recordActivity(actor, {
      module: "calendar",
      action: isNew ? "create" : "update",
      entityId: pid,
      entityName: data.name,
      privacy: "family",
      createdBy: actor.id,
    });
  });

  return pid;
}

export async function deletePetProfile(actor: Actor | null, id: string): Promise<void> {
  assertCan(actor, "calendar.manage");
  const pid = petProfileId(id);

  await db.transaction("rw", db.houseSettings, db.activity, async () => {
    const existing = await db.houseSettings.get(pid);
    if (!existing || !isPetProfile(existing)) throw new NotFoundError("errors.notFound.item");

    await db.houseSettings.delete(pid);
    await recordActivity(actor, {
      module: "calendar",
      action: "delete",
      entityId: pid,
      entityName: existing.name,
      privacy: "family",
      createdBy: actor.id,
    });
  });
}

export async function schedulePetEvent(
  actor: Actor | null,
  pet: PetProfile,
  title: string,
  dateStr: string,
  notes?: string,
): Promise<string> {
  assertCan(actor, "calendar.manage");
  // Medianoche local del día indicado
  const [year, month, day] = dateStr.split("-").map(Number);
  const start = new Date(year, month - 1, day, 9, 0, 0, 0).getTime();
  const end = new Date(year, month - 1, day, 10, 0, 0, 0).getTime();

  return createEvent(actor, {
    title: `${pet.name}: ${title}`,
    start,
    end,
    allDay: true,
    repeat: "none",
    eventKind: "event",
    color: pet.color ?? "gold",
    icon: pet.icon ?? "dog",
    participantIds: [],
    notes: notes || undefined,
  });
}
