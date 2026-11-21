/**
 * Emergencias: lo que conviene tener preparado antes de necesitarlo y que tiene que andar sin
 * Internet. Contactos (con teléfono fijo y dirección), fichas médicas de cada persona, el plan de
 * la familia, lugares cercanos guardados con su posición, canales de radio, llaves de paso y
 * documentos.
 *
 * Todo se guarda en `houseSettings` con id `emergency:<sección>:<id>`: vive en el dispositivo,
 * viaja cifrado si la casa está en la nube y lo edita quien organiza la casa (`calendar.manage`).
 * Los chicos lo ven todo: también son parte del plan.
 */
import { ValidationError } from "@/lib/errors";

export const EMERGENCY_SECTIONS = ["contact", "card", "plan", "place", "radio", "shutoff", "doc"] as const;
export type EmergencySection = (typeof EMERGENCY_SECTIONS)[number];
export type EmergencyId = `emergency:${string}`;

export const CONTACT_ROLES = ["family", "neighbor", "doctor", "school", "work", "other"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const PLACE_CATEGORIES = ["hospital", "police", "fire", "pharmacy", "fuel", "water", "shelter", "meeting", "other"] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const RADIO_USES = ["broadcast", "family", "repeater", "emergency", "other"] as const;
export type RadioUse = (typeof RADIO_USES)[number];

export const UTILITIES = ["water", "gas", "power"] as const;
export type Utility = (typeof UTILITIES)[number];

export const BLOOD_TYPES = ["0+", "0-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;

interface Base<S extends EmergencySection> {
  id: EmergencyId;
  kind: "emergency";
  section: S;
  updatedAt: number;
}

export interface EmergencyContact extends Base<"contact"> {
  name: string;
  role: ContactRole;
  mobile?: string;
  /** Un fijo puede seguir andando cuando la red de celulares se cae. */
  landline?: string;
  address?: string;
  note?: string;
  /** Recibe el mensaje "Estoy bien". */
  notify?: boolean;
}

/** Ficha médica de una persona de la casa (`emergency:card:<miembro>`). */
export interface EmergencyCard extends Base<"card"> {
  memberId: string;
  bloodType?: string;
  allergies?: string;
  medications?: string;
  conditions?: string;
  insurance?: string;
  insuranceNumber?: string;
  doctor?: string;
  note?: string;
}

/** El plan de la familia (uno por casa: `emergency:plan:casa`). */
export interface FamilyPlan extends Base<"plan"> {
  meetingNear?: string;
  meetingFar?: string;
  pickups?: string;
  outOfTown?: string;
  pets?: string;
  okMessage?: string;
  note?: string;
}

export interface EmergencyPlace extends Base<"place"> {
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  note?: string;
}

export interface RadioChannel extends Base<"radio"> {
  name: string;
  use: RadioUse;
  /** MHz, como se escribe en la radio: "146.520". */
  frequency: string;
  /** Tono CTCSS/DCS, si hace falta ("88.5"). */
  tone?: string;
  /** Desplazamiento de un repetidor ("+0.600", "-5.000"). */
  offset?: string;
  note?: string;
}

/** Dónde se corta el agua, el gas o la luz, y cómo. */
export interface Shutoff extends Base<"shutoff"> {
  utility: Utility;
  where: string;
  how?: string;
  /** Lugar de la casa (Inventario) donde está. */
  spaceId?: string;
}

/** Copia de un documento: las fotos van en `photos` con `ownerType: "emergency"` y este id. */
export interface EmergencyDocument extends Base<"doc"> {
  name: string;
  memberId?: string;
  note?: string;
}

export type EmergencyRecord = EmergencyContact | EmergencyCard | FamilyPlan | EmergencyPlace | RadioChannel | Shutoff | EmergencyDocument;
export type EmergencyInput<T extends EmergencyRecord> = Omit<T, "id" | "kind" | "section" | "updatedAt">;

export const PLAN_ID: EmergencyId = "emergency:plan:casa";
export const emergencyId = (section: EmergencySection, id: string): EmergencyId => `emergency:${section}:${id}`;
export const cardId = (memberId: string) => emergencyId("card", memberId);

export function isEmergencyRecord(row: unknown): row is EmergencyRecord {
  if (!row || typeof row !== "object") return false;
  const record = row as { id?: unknown; kind?: unknown; section?: unknown };
  return typeof record.id === "string" && record.id.startsWith("emergency:") && record.kind === "emergency" &&
    (EMERGENCY_SECTIONS as readonly unknown[]).includes(record.section);
}

/** Números de Argentina: vienen con la app, no se guardan ni se pueden borrar. */
export const PUBLIC_NUMBERS = [
  { id: "911", number: "911", color: "blue" },
  { id: "107", number: "107", color: "red" },
  { id: "100", number: "100", color: "volcano" },
  { id: "103", number: "103", color: "gold" },
  { id: "poison", number: "08003330160", color: "purple" },
  { id: "144", number: "144", color: "magenta" },
] as const;
export type PublicNumber = (typeof PUBLIC_NUMBERS)[number];

export const EMERGENCY_LIMITS = { short: 80, phone: 30, text: 500, long: 1500, perSection: 60 } as const;

// --- Validación -----------------------------------------------------------------------

function text(value: unknown, max: number, required = false): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    if (required) throw new ValidationError("errors.validation.nameRequired");
    return undefined;
  }
  if (trimmed.length > max) throw new ValidationError("errors.validation.nameTooLong", { max });
  return trimmed;
}

function phone(value: unknown): string | undefined {
  const cleaned = text(value, EMERGENCY_LIMITS.phone);
  if (cleaned && !/^[+\d][\d\s().-]*$/.test(cleaned)) throw new ValidationError("emergency.errors.phone");
  return cleaned;
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): T {
  if (!(options as readonly unknown[]).includes(value)) throw new ValidationError("errors.validation.kindInvalid");
  return value as T;
}

/** Saca los campos vacíos: así una ficha guardada no arrastra `undefined`. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
}

/** MHz con punto decimal: entre 0,1 y 1300 (lo que una radio de mano recibe o transmite). */
function frequency(value: unknown): string {
  const raw = text(value, 12, true)!.replace(",", ".");
  const parsed = Number(raw);
  if (!/^\d{1,4}(\.\d{1,4})?$/.test(raw) || !(parsed >= 0.1 && parsed <= 1300)) throw new ValidationError("emergency.errors.frequency");
  return raw;
}

export function validateContact(input: EmergencyInput<EmergencyContact>): EmergencyInput<EmergencyContact> {
  const mobile = phone(input.mobile);
  const landline = phone(input.landline);
  if (!mobile && !landline) throw new ValidationError("emergency.errors.phoneRequired");
  return compact({
    name: text(input.name, EMERGENCY_LIMITS.short, true)!,
    role: oneOf(input.role, CONTACT_ROLES),
    mobile,
    landline,
    address: text(input.address, EMERGENCY_LIMITS.text),
    note: text(input.note, EMERGENCY_LIMITS.text),
    notify: input.notify === true ? true : undefined,
  });
}

export function validateCard(input: EmergencyInput<EmergencyCard>): EmergencyInput<EmergencyCard> {
  return compact({
    memberId: text(input.memberId, 80, true)!,
    bloodType: input.bloodType ? oneOf(input.bloodType, BLOOD_TYPES) : undefined,
    allergies: text(input.allergies, EMERGENCY_LIMITS.text),
    medications: text(input.medications, EMERGENCY_LIMITS.text),
    conditions: text(input.conditions, EMERGENCY_LIMITS.text),
    insurance: text(input.insurance, EMERGENCY_LIMITS.short),
    insuranceNumber: text(input.insuranceNumber, EMERGENCY_LIMITS.short),
    doctor: text(input.doctor, EMERGENCY_LIMITS.text),
    note: text(input.note, EMERGENCY_LIMITS.text),
  });
}

export function validatePlan(input: EmergencyInput<FamilyPlan>): EmergencyInput<FamilyPlan> {
  return compact({
    meetingNear: text(input.meetingNear, EMERGENCY_LIMITS.text),
    meetingFar: text(input.meetingFar, EMERGENCY_LIMITS.text),
    pickups: text(input.pickups, EMERGENCY_LIMITS.long),
    outOfTown: text(input.outOfTown, EMERGENCY_LIMITS.text),
    pets: text(input.pets, EMERGENCY_LIMITS.text),
    okMessage: text(input.okMessage, 300),
    note: text(input.note, EMERGENCY_LIMITS.long),
  });
}

export function validatePlace(input: EmergencyInput<EmergencyPlace>): EmergencyInput<EmergencyPlace> {
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new ValidationError("emergency.errors.position");
  return compact({
    name: text(input.name, EMERGENCY_LIMITS.short, true)!,
    category: oneOf(input.category, PLACE_CATEGORIES),
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    address: text(input.address, EMERGENCY_LIMITS.text),
    phone: phone(input.phone),
    note: text(input.note, EMERGENCY_LIMITS.text),
  });
}

export function validateRadio(input: EmergencyInput<RadioChannel>): EmergencyInput<RadioChannel> {
  return compact({
    name: text(input.name, EMERGENCY_LIMITS.short, true)!,
    use: oneOf(input.use, RADIO_USES),
    frequency: frequency(input.frequency),
    tone: text(input.tone, 12),
    offset: text(input.offset, 12),
    note: text(input.note, EMERGENCY_LIMITS.text),
  });
}

export function validateShutoff(input: EmergencyInput<Shutoff>): EmergencyInput<Shutoff> {
  return compact({
    utility: oneOf(input.utility, UTILITIES),
    where: text(input.where, EMERGENCY_LIMITS.text, true)!,
    how: text(input.how, EMERGENCY_LIMITS.long),
    spaceId: text(input.spaceId, 80),
  });
}

export function validateDocument(input: EmergencyInput<EmergencyDocument>): EmergencyInput<EmergencyDocument> {
  return compact({
    name: text(input.name, EMERGENCY_LIMITS.short, true)!,
    memberId: text(input.memberId, 80),
    note: text(input.note, EMERGENCY_LIMITS.text),
  });
}

// --- Posición, distancias y enlaces -----------------------------------------------------

export interface Position { lat: number; lng: number; accuracy?: number }

const EARTH_RADIUS = 6_371_000;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** Metros entre dos puntos (haversine: de sobra para lo que está a pie o a pocos km). */
export function distanceMeters(a: Position, b: Position): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rumbo de `a` hacia `b`, en grados desde el norte (0–360). */
export function bearingDegrees(a: Position, b: Position): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export const COMPASS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export type Compass = (typeof COMPASS)[number];
export const compassPoint = (degrees: number): Compass => COMPASS[Math.round(degrees / 45) % 8];

/** Para buscar lugares: la posición redondeada (unos 100 m), nunca la exacta. */
export const roughPosition = (position: Position): Position => ({ lat: Math.round(position.lat * 1000) / 1000, lng: Math.round(position.lng * 1000) / 1000 });

/** Abre el mapa del celular en ese punto (Google Maps funciona sin datos si bajaste la zona). */
export const mapHref = (place: Position, label?: string) =>
  `geo:${place.lat},${place.lng}?q=${place.lat},${place.lng}${label ? `(${encodeURIComponent(label)})` : ""}`;
export const mapLink = (place: Position) => `https://maps.google.com/?q=${place.lat.toFixed(5)},${place.lng.toFixed(5)}`;

/** Solo dígitos y el + inicial: lo que entiende `tel:` y `sms:`. */
export const dialable = (number: string) => number.replace(/(?!^\+)[^\d]/g, "");
export const telHref = (number: string) => `tel:${dialable(number)}`;

/** Un SMS no necesita datos: es lo que más chance tiene de salir con la red saturada. */
export function smsHref(numbers: string[], body: string): string {
  const to = numbers.map(dialable).filter(Boolean).join(",");
  return `sms:${to}?body=${encodeURIComponent(body)}`;
}

/** Lo que lee la familia: el mensaje elegido, dónde estás (si se pudo) y a qué hora. */
export function okMessage(base: string, where: Position | null, time: string, here: string): string {
  return [base.trim(), where ? `${here} ${mapLink(where)}` : "", time].filter(Boolean).join("\n");
}

// --- Lugares cercanos (OpenStreetMap) -----------------------------------------------------

/** Qué se busca en OpenStreetMap para cada categoría. */
const OSM_TAGS: Record<string, PlaceCategory> = {
  "amenity=hospital": "hospital",
  "amenity=clinic": "hospital",
  "amenity=police": "police",
  "amenity=fire_station": "fire",
  "amenity=pharmacy": "pharmacy",
  "amenity=fuel": "fuel",
  "amenity=drinking_water": "water",
  "amenity=water_point": "water",
  "amenity=shelter": "shelter",
  "emergency=assembly_point": "meeting",
};

/** Consulta de Overpass: lo de `OSM_TAGS` a `radius` metros, con su centro y como mucho 150. */
export function overpassQuery(center: Position, radius = 3000): string {
  const around = `(around:${radius},${center.lat},${center.lng})`;
  const amenities = Object.keys(OSM_TAGS).filter((tag) => tag.startsWith("amenity=")).map((tag) => tag.slice(8)).join("|");
  return `[out:json][timeout:20];(nwr["amenity"~"^(${amenities})$"]${around};nwr["emergency"="assembly_point"]${around};);out center tags 150;`;
}

export interface FoundPlace { osmId: string; name: string; category: PlaceCategory; lat: number; lng: number; address?: string; phone?: string }

interface OverpassElement { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

/** Respuesta de Overpass → lugares con nombre (o el de su categoría), sin repetidos. */
export function parseOverpass(json: unknown, fallbackName: (category: PlaceCategory) => string): FoundPlace[] {
  const elements = (json as { elements?: OverpassElement[] } | null)?.elements;
  if (!Array.isArray(elements)) return [];
  const found: FoundPlace[] = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    const key = Object.keys(OSM_TAGS).find((tag) => { const [k, v] = tag.split("="); return tags[k] === v; });
    if (!key || typeof lat !== "number" || typeof lng !== "number") continue;
    const category = OSM_TAGS[key];
    const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
    found.push({
      osmId: `${element.type}/${element.id}`,
      name: (tags.name ?? fallbackName(category)).slice(0, EMERGENCY_LIMITS.short),
      category,
      lat,
      lng,
      address: street ? street.slice(0, EMERGENCY_LIMITS.text) : undefined,
      phone: (tags.phone ?? tags["contact:phone"])?.split(";")[0]?.trim().slice(0, EMERGENCY_LIMITS.phone) || undefined,
    });
  }
  return found;
}

/**
 * Coordenadas pegadas: "-34.6037, -58.3816", un enlace de Google Maps (`@lat,lng` o `q=lat,lng`)
 * o `geo:lat,lng`. `null` si no hay un par válido.
 */
export function parseCoordinates(text: string): Position | null {
  const match = text.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Qué falta preparar: cada cosa cuenta una vez, para mostrar "tenés 4 de 7". */
export function readiness(data: { contacts: unknown[]; cards: unknown[]; plan?: FamilyPlan; places: unknown[]; radio: unknown[]; shutoffs: unknown[]; docs: unknown[] }, notifyCount: number) {
  const steps = [
    data.contacts.length > 0,
    notifyCount > 0,
    data.cards.length > 0,
    Boolean(data.plan?.meetingNear || data.plan?.meetingFar),
    data.places.length > 0,
    data.shutoffs.length > 0,
    data.docs.length > 0,
  ];
  return { done: steps.filter(Boolean).length, total: steps.length };
}

export const PLACE_COLORS: Record<PlaceCategory, "red" | "blue" | "volcano" | "green" | "gold" | "cyan" | "purple" | "geekblue" | "magenta"> = {
  hospital: "red", police: "blue", fire: "volcano", pharmacy: "green", fuel: "gold", water: "cyan", shelter: "purple", meeting: "magenta", other: "geekblue",
};
