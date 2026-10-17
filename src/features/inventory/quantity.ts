/** Precisión compartida por stock, recetas y compras. Sin equivalencias entre envases y peso. */
export const roundQuantity = (value: number) => Math.round(value * 1000) / 1000;

const ALIASES = new Map([
  ["g", "gr"], ["gramos", "gr"], ["kilo", "kg"], ["kilos", "kg"],
  ["l", "litros"], ["litro", "litros"], ["cc", "ml"],
]);
const MEASURES = new Map<string, [string, number]>([
  ["gr", ["mass", 1]], ["kg", ["mass", 1000]],
  ["ml", ["volume", 1]], ["litros", ["volume", 1000]],
]);

export function normalizeUnit(unit: string): string {
  const value = typeof unit === "string" ? unit.trim().toLowerCase() : "";
  return ALIASES.get(value) ?? value;
}

export function isMeasuredUnit(unit: string): boolean {
  const value = normalizeUnit(unit);
  return MEASURES.has(value) || value === "metros";
}

export function convertQuantity(quantity: number, from: string, to: string): number | null {
  from = normalizeUnit(from);
  to = normalizeUnit(to);
  if (from === to) return quantity;
  const a = MEASURES.get(from);
  const b = MEASURES.get(to);
  return a && b && a[0] === b[0] ? roundQuantity(quantity * a[1] / b[1]) : null;
}
