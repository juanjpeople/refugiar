/**
 * Ficha de mascotas del hogar: identificación, veterinaria de cabecera y guardia,
 * libreta sanitaria (vacunas y desparasitaciones) y medicaciones activas.
 *
 * Se guarda en `houseSettings` con id `pet:<id>`: viaja cifrado en la sincronización
 * de la casa y lo maneja quien organiza la casa y el calendario.
 */
import { isAppearanceColor, isAppearanceIcon, type AppearanceColor, type AppearanceIcon } from "@/lib/appearance";
import { ValidationError } from "@/lib/errors";

export const PET_SPECIES = ["dog", "cat", "bird", "fish", "rodent", "other"] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];

export const PET_GENDERS = ["male", "female"] as const;
export type PetGender = (typeof PET_GENDERS)[number];

export type PetProfileId = `pet:${string}`;

export interface PetVeterinarian {
  name?: string;
  clinic?: string;
  phone?: string;
  emergencyPhone?: string;
  address?: string;
}

export interface PetVaccine {
  id: string;
  name: string;
  date: string;
  nextDueDate?: string;
  notes?: string;
}

export interface PetMedication {
  id: string;
  name: string;
  dose?: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface PetProfile {
  id: PetProfileId;
  kind: "pet";
  name: string;
  species: PetSpecies;
  breed?: string;
  gender?: PetGender;
  birthDate?: string;
  weightKg?: number;
  microchip?: string;
  diet?: string;
  notes?: string;
  veterinarian?: PetVeterinarian;
  vaccines?: PetVaccine[];
  medications?: PetMedication[];
  color?: AppearanceColor;
  icon?: AppearanceIcon;
  updatedAt: number;
}

export type PetProfileInput = Omit<PetProfile, "id" | "kind" | "updatedAt">;

export const PET_LIMITS = {
  nameMaxLength: 60,
  shortTextMaxLength: 80,
  phoneMaxLength: 40,
  notesMaxLength: 1000,
  dietMaxLength: 500,
  maxWeightKg: 300,
} as const;

export function petProfileId(id: string): PetProfileId {
  return id.startsWith("pet:") ? (id as PetProfileId) : (`pet:${id}` as PetProfileId);
}

export function isPetProfile(row: unknown): row is PetProfile {
  if (!row || typeof row !== "object") return false;
  const r = row as { id?: unknown; kind?: unknown };
  return typeof r.id === "string" && r.id.startsWith("pet:") && r.kind === "pet";
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeText(value: string | undefined, max: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) throw new ValidationError("errors.validation.nameTooLong", { max });
  return trimmed;
}

export function defaultPetIcon(species: PetSpecies): AppearanceIcon {
  switch (species) {
    case "dog":
      return "dog";
    case "cat":
      return "cat";
    case "fish":
      return "fish";
    default:
      return "heart";
  }
}

export function defaultPetColor(species: PetSpecies): AppearanceColor {
  switch (species) {
    case "dog":
      return "gold";
    case "cat":
      return "orange";
    case "fish":
      return "cyan";
    case "bird":
      return "lime";
    case "rodent":
      return "volcano";
    default:
      return "purple";
  }
}

export function validatePetProfile(input: unknown): PetProfileInput {
  if (!input || typeof input !== "object") throw new ValidationError("errors.validation.nameRequired");
  const raw = input as Record<string, unknown>;

  const name = sanitizeText(typeof raw.name === "string" ? raw.name : undefined, PET_LIMITS.nameMaxLength);
  if (!name) throw new ValidationError("errors.validation.nameRequired");

  const species = typeof raw.species === "string" && (PET_SPECIES as readonly string[]).includes(raw.species)
    ? (raw.species as PetSpecies)
    : "other";

  const breed = sanitizeText(typeof raw.breed === "string" ? raw.breed : undefined, PET_LIMITS.shortTextMaxLength);
  const gender = typeof raw.gender === "string" && (PET_GENDERS as readonly string[]).includes(raw.gender)
    ? (raw.gender as PetGender)
    : undefined;

  let birthDate: string | undefined;
  if (typeof raw.birthDate === "string" && raw.birthDate.trim()) {
    const trimmed = raw.birthDate.trim();
    if (!DATE_REGEX.test(trimmed)) throw new ValidationError("errors.validation.dateInvalid");
    birthDate = trimmed;
  }

  let weightKg: number | undefined;
  if (raw.weightKg !== undefined && raw.weightKg !== null && raw.weightKg !== "") {
    const num = Number(raw.weightKg);
    if (!Number.isFinite(num) || num <= 0 || num > PET_LIMITS.maxWeightKg) {
      throw new ValidationError("errors.validation.quantityInvalid");
    }
    weightKg = Math.round(num * 100) / 100;
  }

  const microchip = sanitizeText(typeof raw.microchip === "string" ? raw.microchip : undefined, 40);
  const diet = sanitizeText(typeof raw.diet === "string" ? raw.diet : undefined, PET_LIMITS.dietMaxLength);
  const notes = sanitizeText(typeof raw.notes === "string" ? raw.notes : undefined, PET_LIMITS.notesMaxLength);

  let veterinarian: PetVeterinarian | undefined;
  if (raw.veterinarian && typeof raw.veterinarian === "object") {
    const v = raw.veterinarian as Record<string, unknown>;
    const vetName = sanitizeText(typeof v.name === "string" ? v.name : undefined, PET_LIMITS.shortTextMaxLength);
    const clinic = sanitizeText(typeof v.clinic === "string" ? v.clinic : undefined, PET_LIMITS.shortTextMaxLength);
    const phone = sanitizeText(typeof v.phone === "string" ? v.phone : undefined, PET_LIMITS.phoneMaxLength);
    const emergencyPhone = sanitizeText(typeof v.emergencyPhone === "string" ? v.emergencyPhone : undefined, PET_LIMITS.phoneMaxLength);
    const address = sanitizeText(typeof v.address === "string" ? v.address : undefined, PET_LIMITS.shortTextMaxLength);
    if (vetName || clinic || phone || emergencyPhone || address) {
      veterinarian = { name: vetName, clinic, phone, emergencyPhone, address };
    }
  }

  const vaccines: PetVaccine[] = Array.isArray(raw.vaccines)
    ? raw.vaccines
        .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
        .map((v) => {
          const vName = sanitizeText(typeof v.name === "string" ? v.name : undefined, PET_LIMITS.shortTextMaxLength) ?? "";
          const vDate = typeof v.date === "string" && DATE_REGEX.test(v.date.trim()) ? v.date.trim() : "";
          const nextDueDate = typeof v.nextDueDate === "string" && DATE_REGEX.test(v.nextDueDate.trim()) ? v.nextDueDate.trim() : undefined;
          const vNotes = sanitizeText(typeof v.notes === "string" ? v.notes : undefined, PET_LIMITS.notesMaxLength);
          return {
            id: typeof v.id === "string" && v.id ? v.id : crypto.randomUUID(),
            name: vName,
            date: vDate,
            nextDueDate,
            notes: vNotes,
          };
        })
        .filter((v) => v.name && v.date)
    : [];

  const medications: PetMedication[] = Array.isArray(raw.medications)
    ? raw.medications
        .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
        .map((m) => {
          const mName = sanitizeText(typeof m.name === "string" ? m.name : undefined, PET_LIMITS.shortTextMaxLength) ?? "";
          const dose = sanitizeText(typeof m.dose === "string" ? m.dose : undefined, PET_LIMITS.shortTextMaxLength);
          const frequency = sanitizeText(typeof m.frequency === "string" ? m.frequency : undefined, PET_LIMITS.shortTextMaxLength);
          const startDate = typeof m.startDate === "string" && DATE_REGEX.test(m.startDate.trim()) ? m.startDate.trim() : undefined;
          const endDate = typeof m.endDate === "string" && DATE_REGEX.test(m.endDate.trim()) ? m.endDate.trim() : undefined;
          const mNotes = sanitizeText(typeof m.notes === "string" ? m.notes : undefined, PET_LIMITS.notesMaxLength);
          return {
            id: typeof m.id === "string" && m.id ? m.id : crypto.randomUUID(),
            name: mName,
            dose,
            frequency,
            startDate,
            endDate,
            notes: mNotes,
          };
        })
        .filter((m) => m.name)
    : [];

  const color = isAppearanceColor(raw.color) ? raw.color : defaultPetColor(species);
  const icon = isAppearanceIcon(raw.icon) ? raw.icon : defaultPetIcon(species);

  return {
    name,
    species,
    breed,
    gender,
    birthDate,
    weightKg,
    microchip,
    diet,
    notes,
    veterinarian,
    vaccines,
    medications,
    color,
    icon,
  };
}

export interface UpcomingPetEvent {
  id: string;
  petId: PetProfileId;
  petName: string;
  title: string;
  date: string;
  type: "vaccine" | "medication";
  overdue: boolean;
}

export function getUpcomingPetEvents(pets: PetProfile[], referenceDate = new Date()): UpcomingPetEvent[] {
  const todayStr = referenceDate.toISOString().slice(0, 10);
  const events: UpcomingPetEvent[] = [];

  for (const pet of pets) {
    for (const vaccine of pet.vaccines ?? []) {
      if (!vaccine.nextDueDate) continue;
      events.push({
        id: `vac-${vaccine.id}`,
        petId: pet.id,
        petName: pet.name,
        title: vaccine.name,
        date: vaccine.nextDueDate,
        type: "vaccine",
        overdue: vaccine.nextDueDate < todayStr,
      });
    }

    for (const med of pet.medications ?? []) {
      if (!med.endDate) continue;
      events.push({
        id: `med-${med.id}`,
        petId: pet.id,
        petName: pet.name,
        title: med.name,
        date: med.endDate,
        type: "medication",
        overdue: med.endDate < todayStr,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
