/**
 * Escuela de cada chico: si va, a cuál, cómo llega y vuelve, y detalles. Las materias no viven
 * acá: son eventos "class" del calendario (una por día de la semana), así Inicio y Calendario
 * muestran lo mismo.
 *
 * Se guarda en `houseSettings` con id `school:<miembro>`: viaja con la casa (cifrado) y solo
 * la edita quien maneja el calendario.
 */
import { ValidationError } from "@/lib/errors";

export const SHIFTS = ["morning", "afternoon", "double", "evening"] as const;
export type Shift = (typeof SHIFTS)[number];
export const COMMUTES = ["walk", "car", "schoolBus", "publicTransport", "bike", "other"] as const;
export type Commute = (typeof COMMUTES)[number];
/** Días de la semana como en dayjs/Date: 0 = domingo. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;
export const DEFAULT_SCHOOL_DAYS = [1, 2, 3, 4, 5];
/** Una fecha de ese día de la semana, para mostrar su nombre: el 7/1/2024 fue domingo. */
export const weekdayDate = (day: number) => new Date(2024, 0, 7 + day);

export type SchoolProfileId = `school:${string}`;

export interface SchoolProfile {
  id: SchoolProfileId;
  kind: "school";
  memberId: string;
  /** No va a la escuela: queda afuera de la agenda escolar. */
  attends: boolean;
  schoolName?: string;
  address?: string;
  phone?: string;
  /** Grado o año y división, como lo dice la escuela ("3.º B"). */
  grade?: string;
  shift?: Shift;
  /** "HH:mm". */
  entry?: string;
  exit?: string;
  days: number[];
  /** "YYYY-MM-DD": último día de clases. Las materias se repiten hasta acá. */
  termEnd?: string;
  toSchool?: Commute;
  fromSchool?: Commute;
  /** Quién lo lleva y quién lo busca: un nombre de la casa o cualquier texto ("Abuela Rosa"). */
  dropOff?: string;
  pickUp?: string;
  commuteNotes?: string;
  notes?: string;
  updatedAt: number;
}

export type SchoolProfileInput = Omit<SchoolProfile, "id" | "kind" | "memberId" | "updatedAt">;

export const SCHOOL_LIMITS = { textMaxLength: 120, notesMaxLength: 1000 } as const;

export const schoolProfileId = (memberId: string): SchoolProfileId => `school:${memberId}`;

export function isSchoolProfile(row: { id: string } | undefined): row is SchoolProfile {
  return !!row && row.id.startsWith("school:") && (row as SchoolProfile).kind === "school";
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: string | undefined, max: number = SCHOOL_LIMITS.textMaxLength) {
  const trimmed = value?.trim() || undefined;
  if (trimmed && trimmed.length > max) throw new ValidationError("errors.validation.nameTooLong", { max });
  return trimmed;
}

function choice<T extends string>(value: T | undefined, options: readonly T[]) {
  if (value === undefined || value === null || (value as string) === "") return undefined;
  if (!options.includes(value)) throw new ValidationError("errors.validation.kindInvalid");
  return value;
}

export function parseSchoolProfile(input: SchoolProfileInput): SchoolProfileInput {
  if (typeof input.attends !== "boolean") throw new ValidationError("errors.validation.kindInvalid");
  const entry = input.entry || undefined;
  const exit = input.exit || undefined;
  if ((entry && !TIME.test(entry)) || (exit && !TIME.test(exit)) || (entry && exit && exit <= entry)) throw new ValidationError("errors.validation.dateInvalid");
  const termEnd = input.termEnd || undefined;
  if (termEnd && (!DATE.test(termEnd) || Number.isNaN(Date.parse(termEnd)))) throw new ValidationError("errors.validation.dateInvalid");
  const days = [...new Set(input.days ?? [])].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).sort();
  const profile: SchoolProfileInput = {
    attends: input.attends,
    schoolName: text(input.schoolName),
    address: text(input.address),
    phone: text(input.phone),
    grade: text(input.grade),
    shift: choice(input.shift, SHIFTS),
    entry,
    exit,
    days,
    termEnd,
    toSchool: choice(input.toSchool, COMMUTES),
    fromSchool: choice(input.fromSchool, COMMUTES),
    dropOff: text(input.dropOff),
    pickUp: text(input.pickUp),
    commuteNotes: text(input.commuteNotes, SCHOOL_LIMITS.notesMaxLength),
    notes: text(input.notes, SCHOOL_LIMITS.notesMaxLength),
  };
  return Object.fromEntries(Object.entries(profile).filter(([, value]) => value !== undefined)) as SchoolProfileInput;
}

/** "HH:mm" del día `date` (ms) como timestamp local. */
export function atTime(date: number, time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  const day = new Date(date);
  day.setHours(hours, minutes, 0, 0);
  return day.getTime();
}

/** Primer día `weekday` (0 = domingo) desde `from` inclusive, a la medianoche local. */
export function nextWeekday(from: number, weekday: number): number {
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + ((weekday - day.getDay() + 7) % 7));
  return day.getTime();
}
