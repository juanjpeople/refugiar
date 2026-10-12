import type { Transaction } from "dexie";
import type { InventoryItem } from "@/features/inventory/domain";
import fixture from "./house.json" with { type: "json" };
import { demoSchool } from "./school";

/** Datos públicos y ficticios. No se consulta una cuenta ni se descarga contenido remoto. */
export function demoData(now = Date.now()) {
  const data = structuredClone(fixture);
  const offset = now - Date.parse(data.exportedAt);
  for (const rows of Object.values(data.tables)) for (const row of rows) {
    const record = row as Record<string, unknown>;
    for (const field of ["createdAt", "updatedAt", "at", "start", "end", "boughtAt"]) {
      if (typeof record[field] === "number") record[field] += offset;
    }
  }
  data.exportedAt = new Date(now).toISOString();
  return data;
}

export function decodeDemoRows(rows: object[]) {
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value && typeof value === "object" && "$blob" in value && "type" in value) {
      const encoded = value as { $blob: string; type: string };
      const bytes = Uint8Array.from(atob(encoded.$blob), char => char.charCodeAt(0));
      return [key, new Blob([bytes], { type: encoded.type })];
    }
    return [key, value];
  })));
}

/** Add missing examples only; retain existing rows and user edits. */
export async function populateDemo(tx: Transaction) {
  for (const [name, rows] of Object.entries(demoData().tables)) {
    const table = tx.table(name);
    const decoded = decodeDemoRows(rows);
    const existing = new Set(await table.toCollection().primaryKeys());
    const missing = decoded.filter(row => !existing.has(row.id));
    if (missing.length) await table.bulkAdd(missing);
  }
  await addDemoSchool(tx);
}

/** Escuela de ejemplo (fichas, materias y la agenda de Inicio). Solo suma lo que falta. */
export async function addDemoSchool(tx: Transaction) {
  const { profiles, events, calendar } = demoSchool();
  for (const [name, rows] of [["houseSettings", [calendar, ...profiles]], ["events", events]] as const) {
    const table = tx.table(name);
    const existing = new Set(await table.toCollection().primaryKeys());
    const missing = rows.filter((row) => !existing.has(row.id));
    if (missing.length) await table.bulkAdd(missing);
  }
}

export async function backfillDemoTools(tx: Transaction) {
  const tools = new Map(fixture.tables.inventory.filter(row => "reusable" in row && row.reusable === true).map(row => [row.id, row.name]));
  await tx.table<InventoryItem>("inventory").toCollection().modify(item => {
    if (item.reusable === undefined && tools.get(item.id) === item.name) {
      item.reusable = true;
      item.autoSuggest ??= false;
    }
  });
}
