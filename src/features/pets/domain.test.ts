import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validatePetProfile,
  isPetProfile,
  petProfileId,
  getUpcomingPetEvents,
  defaultPetColor,
  defaultPetIcon,
  type PetProfile,
} from "./domain";

test("defaultPetColor e defaultPetIcon retornan apariencias por especie", () => {
  assert.equal(defaultPetColor("dog"), "gold");
  assert.equal(defaultPetColor("cat"), "orange");
  assert.equal(defaultPetIcon("dog"), "dog");
  assert.equal(defaultPetIcon("cat"), "cat");
});

test("isPetProfile reconoce correctamente las entidades", () => {
  assert.equal(isPetProfile(undefined), false);
  assert.equal(isPetProfile(null), false);
  assert.equal(isPetProfile({ id: "school:123" }), false);
  assert.equal(isPetProfile({ id: "pet:abc", kind: "pet" }), true);
});

test("petProfileId antepone el prefijo pet:", () => {
  assert.equal(petProfileId("123"), "pet:123");
  assert.equal(petProfileId("pet:123"), "pet:123");
});

test("validatePetProfile valida campos requeridos y formatos", () => {
  assert.throws(() => validatePetProfile({}), /errors\.validation\.nameRequired/);
  assert.throws(() => validatePetProfile({ name: "   " }), /errors\.validation\.nameRequired/);

  // Fecha inválida
  assert.throws(
    () => validatePetProfile({ name: "Luna", birthDate: "fecha-invalida" }),
    /errors\.validation\.dateInvalid/,
  );

  // Peso negativo o absurdo
  assert.throws(
    () => validatePetProfile({ name: "Luna", weightKg: -5 }),
    /errors\.validation\.quantityInvalid/,
  );
  assert.throws(
    () => validatePetProfile({ name: "Luna", weightKg: 999 }),
    /errors\.validation\.quantityInvalid/,
  );

  // Perfil válido mínimo
  const min = validatePetProfile({ name: "Luna", species: "dog" });
  assert.equal(min.name, "Luna");
  assert.equal(min.species, "dog");
  assert.equal(min.icon, "dog");
  assert.equal(min.color, "gold");

  // Perfil con veterinario y vacunas
  const full = validatePetProfile({
    name: "Milo",
    species: "cat",
    breed: "Común europeo",
    gender: "male",
    birthDate: "2023-05-10",
    weightKg: 4.8,
    microchip: "981098109810981",
    veterinarian: {
      name: "Dra. Sofía Martínez",
      clinic: "Clínica Veterinaria San Roque",
      phone: "+54 11 4567-8901",
      emergencyPhone: "+54 11 9999-0000",
    },
    vaccines: [
      { id: "v1", name: "Triple felina", date: "2024-05-15", nextDueDate: "2025-05-15" },
    ],
    medications: [
      { id: "m1", name: "Pipeta antipulgas", dose: "1 pipeta", frequency: "Mensual", startDate: "2024-05-01", endDate: "2024-06-01" },
    ],
  });

  assert.equal(full.name, "Milo");
  assert.equal(full.species, "cat");
  assert.equal(full.weightKg, 4.8);
  assert.equal(full.veterinarian?.phone, "+54 11 4567-8901");
  assert.equal(full.vaccines?.length, 1);
  assert.equal(full.medications?.length, 1);
});

test("getUpcomingPetEvents lista vacunas y medicaciones por vencer ordenadas", () => {
  const petA: PetProfile = {
    id: "pet:1",
    kind: "pet",
    name: "Luna",
    species: "dog",
    vaccines: [
      { id: "vac-1", name: "Antirrábica", date: "2025-01-10", nextDueDate: "2026-01-10" },
      { id: "vac-2", name: "Séxtuple", date: "2026-02-01", nextDueDate: "2027-02-01" },
    ],
    medications: [
      { id: "med-1", name: "Antibiótico", endDate: "2026-03-15" },
    ],
    updatedAt: 123456789,
  };

  const events = getUpcomingPetEvents([petA], new Date("2026-06-01"));
  assert.equal(events.length, 3);
  // Ordenado por fecha:
  assert.equal(events[0].date, "2026-01-10");
  assert.equal(events[0].overdue, true); // 2026-01-10 < 2026-06-01
  assert.equal(events[1].date, "2026-03-15");
  assert.equal(events[1].overdue, true);
  assert.equal(events[2].date, "2027-02-01");
  assert.equal(events[2].overdue, false);
});
