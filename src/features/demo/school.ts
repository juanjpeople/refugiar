/**
 * Escuela de la casa demo. Se arma con la fecha de hoy (no viene en `house.json`): las clases
 * tienen que caer en su día y su hora, y el corrimiento de fechas del fixture las movería.
 */
import type { CalendarEvent } from "@/features/calendar/domain";
import type { CalendarSettings } from "@/features/calendar/settings";
import { atTime, nextWeekday, schoolProfileId, type SchoolProfile } from "@/features/school/domain";
import type { AppearanceColor } from "@/lib/appearance";

const MATEO = "be294ed3-1fd2-4e91-982b-d6c725752f72";
const ALMA = "db3ccd4b-c0aa-48ee-8075-87b4a46e4b5b";
const LUCA = "profile-kid";
const DAY = 86_400_000;

const isoDate = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function demoSchool(now = Date.now()) {
  const termEnd = now + 180 * DAY;
  const until = new Date(termEnd).setHours(23, 59, 59, 999);
  const weekAgo = now - 7 * DAY;
  const school = { schoolName: "Escuela N.º 7 Almafuerte (demo)", address: "Av. Siempreviva 742 (demo)", phone: "011 4555-0000", days: [1, 2, 3, 4, 5], termEnd: isoDate(termEnd) };

  const profiles: SchoolProfile[] = [
    {
      ...school, id: schoolProfileId(MATEO), kind: "school", memberId: MATEO, attends: true, grade: "5.º A", shift: "morning", entry: "07:45", exit: "12:30",
      toSchool: "walk", dropOff: "Marina", fromSchool: "schoolBus", pickUp: "Transporte Don Pedro (demo)",
      commuteNotes: "Los viernes lo busca Tomás a la salida.", notes: "Alergia leve al maní. Maestra: Laura Gómez (demo).", updatedAt: now,
    },
    {
      ...school, id: schoolProfileId(ALMA), kind: "school", memberId: ALMA, attends: true, grade: "2.º B", shift: "afternoon", entry: "13:00", exit: "17:30",
      toSchool: "car", dropOff: "Tomás", fromSchool: "car", pickUp: "Elena", notes: "Los miércoles va con uniforme de gimnasia.", updatedAt: now,
    },
    { id: schoolProfileId(LUCA), kind: "school", memberId: LUCA, attends: false, days: [], notes: "Empieza preescolar el año que viene.", updatedAt: now },
  ];

  const subject = (key: string, member: string, color: AppearanceColor, title: string, weekday: number, start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => {
    const day = nextWeekday(weekAgo, weekday);
    return {
      id: `demo-class-${key}-${weekday}`, title: `${title} — DEMO`, privacy: "family", start: atTime(day, start), end: atTime(day, end), allDay: false,
      repeat: "weekly", repeatUntil: until, eventKind: "class", participantIds: [member], color, icon: "bookOpen", createdBy: "profile-admin", createdAt: now, updatedAt: now, ...extra,
    };
  };
  const events: CalendarEvent[] = [
    ...[1, 3].map((day) => subject("mateo-math", MATEO, "gold", "Matemática", day, "07:45", "09:05", { teacher: "Laura Gómez", notes: "Carpeta azul y calculadora." })),
    ...[2, 4].map((day) => subject("mateo-language", MATEO, "gold", "Prácticas del lenguaje", day, "07:45", "09:05", { teacher: "Laura Gómez" })),
    subject("mateo-english", MATEO, "gold", "Inglés", 3, "10:30", "11:30", { teacher: "Ana Ruiz", notes: "Libro de inglés." }),
    subject("mateo-pe", MATEO, "gold", "Educación física", 5, "10:00", "11:20", { notes: "Zapatillas y botella de agua." }),
    ...[1, 3].map((day) => subject("alma-language", ALMA, "orange", "Prácticas del lenguaje", day, "13:00", "14:20", { teacher: "Sergio Paz" })),
    ...[2, 4].map((day) => subject("alma-math", ALMA, "orange", "Matemática", day, "13:00", "14:20", { teacher: "Sergio Paz" })),
    subject("alma-music", ALMA, "orange", "Música", 5, "14:30", "15:30", { notes: "Flauta dulce." }),
    {
      id: "demo-homework-mateo", title: "Mapa de las provincias — DEMO", privacy: "family", start: new Date(now).setHours(0, 0, 0, 0), end: new Date(now).setHours(0, 0, 0, 0), allDay: true,
      repeat: "none", eventKind: "homework", homeworkDone: false, participantIds: [MATEO], color: "gold", icon: "bookOpen", notes: "Pintarlo y escribir las capitales.", createdBy: "profile-admin", createdAt: now, updatedAt: now,
    },
  ];

  const calendar: CalendarSettings = { id: "calendar", country: "", state: "", region: "", schoolEnabled: true, updatedAt: now };
  return { profiles, events, calendar };
}
