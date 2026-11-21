import { PLAN_ID, cardId, emergencyId, type EmergencyRecord } from "@/features/emergency/domain";

const TOMAS = "4fa276ae-dfbf-4c14-af72-e999e458dfa0";
const ELENA = "5a258a45-7fa3-46c3-a6f5-c84d5a0ca545";
const MATEO = "be294ed3-1fd2-4e91-982b-d6c725752f72";
const KITCHEN = "721a4e57-6c43-4c9c-9dfc-d86c0c88ce98";
const LAUNDRY = "f4b70a0d-77bf-4336-8930-05011ff83ac9";

/** Emergencias de ejemplo: datos inventados (teléfonos y lugares de mentira), para recorrer la sección. */
export function demoEmergency(now = Date.now()): EmergencyRecord[] {
  const base = { kind: "emergency" as const, updatedAt: now };
  return [
    { ...base, section: "contact", id: emergencyId("contact", "abuela"), name: "Abuela Rosa (demo)", role: "family", mobile: "011 15 4000-1111", landline: "011 4000-2222", address: "Av. Siempreviva 742 (demo)", notify: true },
    { ...base, section: "contact", id: emergencyId("contact", "tomas"), name: "Tomás (demo)", role: "family", mobile: "011 15 4000-3333", notify: true },
    { ...base, section: "contact", id: emergencyId("contact", "vecina"), name: "Marta, la vecina (demo)", role: "neighbor", landline: "011 4000-4444", note: "Tiene llave de casa." },
    { ...base, section: "contact", id: emergencyId("contact", "pediatra"), name: "Dra. Paz, pediatra (demo)", role: "doctor", mobile: "011 15 4000-5555" },
    { ...base, section: "card", id: cardId(TOMAS), memberId: TOMAS, bloodType: "A+", allergies: "Penicilina", insurance: "Obra social (demo)", insuranceNumber: "12345678/01" },
    { ...base, section: "card", id: cardId(ELENA), memberId: ELENA, bloodType: "0+", medications: "Levotiroxina 50 mcg, a la mañana" },
    { ...base, section: "card", id: cardId(MATEO), memberId: MATEO, bloodType: "0+", allergies: "Maní", conditions: "Asma leve: usa aerosol (en la mochila)" },
    { ...base, section: "plan", id: PLAN_ID, meetingNear: "La esquina de la plaza, frente al kiosco", meetingFar: "Casa de la abuela Rosa", pickups: "Mateo y Alma: los busca Elena. Si no puede, la abuela.", outOfTown: "Tía Laura en Córdoba (demo)", pets: "Milo va con quien salga primero. Correa en el perchero." },
    { ...base, section: "place", id: emergencyId("place", "hospital"), name: "Hospital de ejemplo (demo)", category: "hospital", lat: -34.5815, lng: -58.4065, phone: "107" },
    { ...base, section: "place", id: emergencyId("place", "comisaria"), name: "Comisaría de ejemplo (demo)", category: "police", lat: -34.5905, lng: -58.4150 },
    { ...base, section: "place", id: emergencyId("place", "bomberos"), name: "Cuartel de bomberos (demo)", category: "fire", lat: -34.5960, lng: -58.4020 },
    { ...base, section: "place", id: emergencyId("place", "farmacia"), name: "Farmacia de turno (demo)", category: "pharmacy", lat: -34.5880, lng: -58.4090 },
    { ...base, section: "radio", id: emergencyId("radio", "fm"), name: "Noticias FM (demo)", use: "broadcast", frequency: "98.7" },
    { ...base, section: "radio", id: emergencyId("radio", "familia"), name: "Canal de la familia (demo)", use: "family", frequency: "146.520", note: "Solo escuchar sin licencia." },
    { ...base, section: "shutoff", id: emergencyId("shutoff", "gas"), utility: "gas", where: "Al lado del medidor, en la vereda", how: "Girar la manija un cuarto de vuelta: cruzada al caño es cerrada.", spaceId: KITCHEN },
    { ...base, section: "shutoff", id: emergencyId("shutoff", "agua"), utility: "water", where: "Abajo de la pileta del lavadero", how: "Girar hacia la derecha hasta el tope.", spaceId: LAUNDRY },
    { ...base, section: "shutoff", id: emergencyId("shutoff", "luz"), utility: "power", where: "Tablero en el pasillo, arriba de la puerta", how: "Bajar la palanca grande (general)." },
  ];
}
