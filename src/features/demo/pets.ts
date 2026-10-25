import type { PetProfile } from "@/features/pets/domain";

export function demoPet(now = Date.now()): PetProfile {
  return {
    id: "pet:milo",
    kind: "pet",
    name: "Milo",
    species: "dog",
    breed: "Golden Retriever",
    gender: "male",
    birthDate: "2021-04-15",
    weightKg: 28.5,
    diet: "Alimento balanceado premium, 350g al día divididos en dos tomas.",
    notes: "Muy dócil y juguetón. Tiene miedo a las tormentas fuertes.",
    veterinarian: {
      name: "Dra. Carolina Martínez (demo)",
      clinic: "Veterinaria San Roque (demo)",
      phone: "011 4555-1234",
      emergencyPhone: "011 4555-9999",
      address: "Av. Belgrano 1240 (demo)",
    },
    vaccines: [
      {
        id: "v-antirrabica",
        name: "Antirrábica",
        date: "2026-03-10",
        nextDueDate: "2027-03-10",
        notes: "Campaña de vacunación",
      },
      {
        id: "v-sextuple",
        name: "Séxtuple",
        date: "2026-04-12",
        nextDueDate: "2027-04-12",
        notes: "Refuerzo anual al día",
      },
    ],
    medications: [
      {
        id: "m-nexgard",
        name: "Nexgard Spectra",
        dose: "1 comprimido masticable (30 kg)",
        frequency: "Mensual",
        startDate: "2026-10-01",
        notes: "Antiparasitario interno y externo (pulgas y garrapatas)",
      },
    ],
    color: "gold",
    icon: "dog",
    updatedAt: now,
  };
}
