/**
 * Servicio de la escuela: ÚNICO punto que escribe la ficha escolar de cada chico. Las materias
 * se escriben con el servicio del calendario (son eventos "class").
 */
import { recordActivity } from "@/features/activity/service";
import { createEvent } from "@/features/calendar/service";
import type { EventInput } from "@/features/calendar/domain";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { atTime, nextWeekday, parseSchoolProfile, schoolProfileId, type SchoolProfile, type SchoolProfileInput } from "./domain";

export async function saveSchoolProfile(actor: Actor | null, memberId: string, input: SchoolProfileInput) {
  assertCan(actor, "calendar.manage");
  const data = parseSchoolProfile(input);
  await db.transaction("rw", db.houseSettings, db.members, db.activity, async () => {
    const member = await db.members.get(memberId);
    if (!member) throw new NotFoundError("errors.notFound.member");
    // `put` reemplaza la ficha entera: un campo vaciado no queda con el valor viejo.
    const profile: SchoolProfile = { ...data, id: schoolProfileId(memberId), kind: "school", memberId, updatedAt: Date.now() };
    await db.houseSettings.put(profile);
    await recordActivity(actor, { module: "calendar", action: "update", entityId: schoolProfileId(memberId), entityName: member.name, privacy: "family", createdBy: actor.id });
  });
}

export interface SubjectInput {
  memberId: string;
  title: string;
  /** Días de la semana (0 = domingo). Se crea una materia semanal por día. */
  weekdays: number[];
  /** "HH:mm". */
  start: string;
  end: string;
  /** Primera clase posible (ms) y último día de clases (ms). */
  from: number;
  until: number;
  teacher?: string;
  notes?: string;
  color: EventInput["color"];
}

/** Crea la materia en cada día elegido. Devuelve los ids de los eventos. */
export async function addSubject(actor: Actor | null, input: SubjectInput) {
  assertCan(actor, "calendar.manage");
  if (!input.weekdays.length) throw new ValidationError("errors.validation.dateInvalid");
  // Todo junto: si un día falla, no queda la materia a medias.
  return db.transaction("rw", db.events, db.members, db.activity, async () => {
    const ids: string[] = [];
    for (const weekday of [...new Set(input.weekdays)]) {
      const day = nextWeekday(input.from, weekday);
      ids.push(await createEvent(actor, {
        title: input.title,
        privacy: "family",
        start: atTime(day, input.start),
        end: atTime(day, input.end),
        allDay: false,
        repeat: "weekly",
        repeatUntil: input.until,
        eventKind: "class",
        teacher: input.teacher,
        participantIds: [input.memberId],
        color: input.color,
        icon: "bookOpen",
        notes: input.notes,
      }));
    }
    return ids;
  });
}
