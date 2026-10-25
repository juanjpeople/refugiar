/**
 * Recetas de la casa: ingredientes vinculados al inventario (o texto libre), pasos, etiquetas
 * y porciones. Sin React ni base de datos.
 */
import { INVENTORY_LIMITS, isUnit, type InventoryItem, type Unit } from "@/features/inventory/domain";
import { convertQuantity, isMeasuredUnit, normalizeUnit, roundQuantity } from "@/features/inventory/quantity";
import { ValidationError } from "@/lib/errors";
import { isPrivacy, type Privacy } from "@/lib/sync/scope";

/** Etiquetas fijas (se traducen con `recipes.tags.<id>`): así se filtran igual en cualquier idioma. */
export const RECIPE_TAGS = ["quick", "vegetarian", "vegan", "kids", "healthy", "dessert", "budget", "batch", "party"] as const;
export type RecipeTag = (typeof RECIPE_TAGS)[number];

export interface RecipeIngredient {
  /** Producto del inventario: permite saber si hay y descontarlo al cocinar. */
  itemId?: string;
  /** Nombre visible. Si está vinculado, se guarda igual (por si el producto se borra). */
  name: string;
  /** Para la cantidad de porciones de la receta. Medidas compatibles con el producto vinculado; admite decimales. */
  quantity: number;
  unit: string;
}

export interface Recipe {
  externalShareOwners?: string[];
  id: string;
  name: string;
  /** Quién la ve con la casa en la nube (por defecto, Familia). Sus comentarios heredan el nivel. */
  privacy?: Privacy;
  servings: number;
  /** Tiempo total aproximado, en minutos. */
  minutes: number;
  /** Los ingredientes viven dentro de la receta: se guardan y se exportan juntos, siempre coherentes. */
  ingredients: RecipeIngredient[];
  steps: string[];
  /** Duración explícita por paso, en segundos. Cero significa sin temporizador. */
  stepSeconds?: number[];
  tags: RecipeTag[];
  /** Foto principal (las demás son la galería, ver `features/media`). */
  coverPhotoId?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type RecipeInput = Pick<Recipe, "name" | "servings" | "minutes" | "ingredients" | "steps" | "tags"> & { privacy?: Privacy; stepSeconds?: number[] };

export const RECIPE_LIMITS = {
  nameMaxLength: 80,
  maxServings: 50,
  maxMinutes: 24 * 60,
  maxIngredients: 40,
  maxSteps: 40,
  stepMaxLength: 1_000,
} as const;

function isTag(value: string): value is RecipeTag {
  return (RECIPE_TAGS as readonly string[]).includes(value);
}

function parseIngredient(input: RecipeIngredient): RecipeIngredient {
  const name = input.name?.trim() ?? "";
  if (!name) throw new ValidationError("errors.validation.ingredientName");
  if (name.length > INVENTORY_LIMITS.nameMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: INVENTORY_LIMITS.nameMaxLength });
  const linked = !!input.itemId;
  // Las medidas admiten decimales; las unidades contables vinculadas siguen siendo enteras.
  const validQuantity = typeof input.quantity === "number" && Number.isFinite(input.quantity) && input.quantity >= 0.001 && input.quantity <= INVENTORY_LIMITS.maxQuantity;
  if (!validQuantity || (linked && !isMeasuredUnit(input.unit) && !Number.isInteger(input.quantity))) throw new ValidationError("errors.validation.quantityInvalid");
  const unit = normalizeUnit(input.unit ?? "");
  if (linked && !isUnit(unit) && unit !== "ml") throw new ValidationError("errors.validation.unitInvalid");
  return { itemId: input.itemId || undefined, name, quantity: roundQuantity(input.quantity), unit: unit.slice(0, 20) };
}

// --- Pegar una receta --------------------------------------------------------------

/** Unidades escritas a mano → las del inventario. Lo demás (taza, cucharada) queda como se escribió. */
const UNIT_WORDS: Record<string, Unit> = {
  g: "gr", gr: "gr", grs: "gr", gramo: "gr", gramos: "gr",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogramo: "kg", kilogramos: "kg",
  l: "litros", lt: "litros", lts: "litros", litro: "litros", litros: "litros",
  unidad: "unidades", unidades: "unidades", u: "unidades",
  paquete: "paquetes", paquetes: "paquetes",
  metro: "metros", metros: "metros",
};
/** Medidas de cocina que no están en el inventario: se guardan tal cual, como unidad del ingrediente suelto. */
const KITCHEN_UNITS = new Set(["ml", "cc", "taza", "tazas", "cda", "cdas", "cucharada", "cucharadas", "cdita", "cditas", "cucharadita", "cucharaditas", "pizca", "pizcas", "diente", "dientes", "lata", "latas", "sobre", "sobres", "cup", "cups", "tbsp", "tsp"]);
const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

/** Saca viñetas, números de lista y casillas del principio de un renglón. */
function stripMarker(line: string): string {
  return line.replace(/^\s*(?:[-*•·–—]+|\d+\s*[.)-]\s|\[[ xX]?\]|[☐☑✓✔])\s*/u, "").trim();
}

function parseAmount(text: string): number | null {
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[2]) ? Number(fraction[1]) / Number(fraction[2]) : null;
  if (text in FRACTIONS) return FRACTIONS[text];
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** "200 g de harina", "2 huevos", "½ taza de leche", "Sal a gusto" → un ingrediente suelto. */
export function parseIngredientLine(raw: string): { name: string; quantity: number; unit: string } | null {
  const line = stripMarker(raw);
  if (!line) return null;
  const match = line.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])\s*(.*)$/u);
  const amount = match ? parseAmount(match[1]) : null;
  let rest = match && amount !== null && amount > 0 ? match[2] : line;
  let unit = "";
  if (rest !== line) {
    const word = rest.match(/^([\p{L}.]+)\s+(.*)$/u);
    const key = word?.[1].toLowerCase().replace(/\.$/, "");
    if (word && key && (key in UNIT_WORDS || KITCHEN_UNITS.has(key))) {
      unit = UNIT_WORDS[key] ?? word[1].replace(/\.$/, "");
      rest = word[2];
    }
    rest = rest.replace(/^de\s+/i, "");
  }
  const name = rest.trim().slice(0, INVENTORY_LIMITS.nameMaxLength);
  if (!name) return null;
  const quantity = rest !== line && amount !== null ? Math.min(amount, INVENTORY_LIMITS.maxQuantity) : 1;
  return { name, quantity: Math.round(quantity * 100) / 100, unit: unit || (rest !== line ? "unidades" : "") };
}

/** La preparación pegada → un paso por renglón (sin "1.", "Paso 2:" ni renglones vacíos). */
export function parseStepLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => stripMarker(line).replace(/^paso\s*\d+\s*[:.)-]?\s*/i, "").trim().slice(0, RECIPE_LIMITS.stepMaxLength))
    .filter(Boolean)
    .slice(0, RECIPE_LIMITS.maxSteps);
}

/** Normaliza y valida. Los formularios validan para UX; esto es lo que vale. */
export function parseRecipe(input: RecipeInput): RecipeInput & { privacy: Privacy } {
  const name = input.name?.trim() ?? "";
  const privacy = input.privacy ?? "family";
  if (!name) throw new ValidationError("errors.validation.nameRequired");
  if (name.length > RECIPE_LIMITS.nameMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: RECIPE_LIMITS.nameMaxLength });
  if (!isPrivacy(privacy)) throw new ValidationError("errors.validation.kindInvalid");
  if (!Number.isInteger(input.servings) || input.servings < 1 || input.servings > RECIPE_LIMITS.maxServings) {
    throw new ValidationError("errors.validation.servingsInvalid");
  }
  if (!Number.isInteger(input.minutes) || input.minutes < 0 || input.minutes > RECIPE_LIMITS.maxMinutes) {
    throw new ValidationError("errors.validation.minutesInvalid");
  }
  const ingredients = (input.ingredients ?? []).map(parseIngredient);
  if (ingredients.length > RECIPE_LIMITS.maxIngredients) throw new ValidationError("errors.validation.tooMany", { max: RECIPE_LIMITS.maxIngredients });
  const prepared = (input.steps ?? []).map((step, index) => ({ text: step.trim(), seconds: input.stepSeconds?.[index] ?? 0 })).filter(step => step.text);
  if (prepared.some(step => !Number.isInteger(step.seconds) || step.seconds < 0 || step.seconds > 86400)) throw new ValidationError("errors.validation.minutesInvalid");
  const steps = prepared.map(step => step.text);
  const stepSeconds = prepared.map(step => step.seconds);
  if (steps.length > RECIPE_LIMITS.maxSteps) throw new ValidationError("errors.validation.tooMany", { max: RECIPE_LIMITS.maxSteps });
  if (steps.some((step) => step.length > RECIPE_LIMITS.stepMaxLength)) {
    throw new ValidationError("errors.validation.nameTooLong", { max: RECIPE_LIMITS.stepMaxLength });
  }
  const tags = [...new Set((input.tags ?? []).filter(isTag))];
  return { name, privacy, servings: input.servings, minutes: input.minutes, ingredients, steps, ...(input.stepSeconds ? { stepSeconds } : {}), tags };
}

// --- Porciones y disponibilidad -------------------------------------------------

/** Cantidad de un ingrediente para otra cantidad de porciones. Las unidades contables se redondean hacia arriba; las medidas conservan tres decimales. */
export function scaleQuantity(ingredient: Pick<RecipeIngredient, "quantity" | "itemId"> & { unit?: string }, from: number, to: number): number {
  const scaled = (ingredient.quantity * to) / from;
  if (ingredient.itemId && !isMeasuredUnit(ingredient.unit ?? "unidades")) return Math.max(1, Math.ceil(scaled - 1e-9));
  return Math.max(0.001, roundQuantity(scaled));
}

export type IngredientState = "ok" | "short" | "missing" | "unlinked";

export interface IngredientCheck {
  ingredient: RecipeIngredient;
  /** Cantidad necesaria para las porciones pedidas. */
  needed: number;
  /** Lo que hay en casa (solo vinculados que siguen existiendo). */
  have?: number;
  state: IngredientState;
  item?: InventoryItem;
}

/** "ready" = hay todo · "almost" = falta poco · "missing" = falta mucho · "unknown" = nada vinculado. */
export type Availability = "ready" | "almost" | "missing" | "unknown";

export interface AvailabilityReport {
  availability: Availability;
  checks: IngredientCheck[];
  /** Ingredientes vinculados que no alcanzan. */
  lacking: IngredientCheck[];
}

/**
 * ¿Se puede cocinar con lo que hay? Solo cuentan los ingredientes vinculados al inventario
 * (de los sueltos no se sabe). "Falta poco" = falta uno, o hasta un cuarto de lo vinculado.
 */
export function checkAvailability(recipe: Pick<Recipe, "ingredients" | "servings">, items: Map<string, InventoryItem>, servings = recipe.servings): AvailabilityReport {
  // Agrupar antes de comparar: masa y relleno comparten el mismo stock.
  const grouped = new Map<string, RecipeIngredient>();
  for (const ingredient of recipe.ingredients) {
    const item = ingredient.itemId ? items.get(ingredient.itemId) : undefined;
    const converted = item && !item.reusable ? convertQuantity(ingredient.quantity, ingredient.unit, item.unit) : null;
    const resolved = converted !== null && item ? { ...ingredient, quantity: converted, unit: item.unit } : ingredient;
    const key = converted !== null ? `item:${ingredient.itemId}` : `free:${normalizeIngredient(ingredient.name)}:${normalizeUnit(ingredient.unit)}`;
    const previous = grouped.get(key);
    grouped.set(key, previous ? { ...previous, quantity: roundQuantity(previous.quantity + resolved.quantity) } : { ...resolved });
  }
  const checks = [...grouped.values()].map((ingredient): IngredientCheck => {
    const needed = scaleQuantity(ingredient, recipe.servings, servings);
    const item = ingredient.itemId ? items.get(ingredient.itemId) : undefined;
    if (!item || item.reusable || convertQuantity(needed, ingredient.unit, item.unit) === null) return { ingredient, needed, state: "unlinked" };
    const have = roundQuantity(item.quantity);
    const state: IngredientState = have >= needed ? "ok" : have > 0 ? "short" : "missing";
    return { ingredient, needed, have, state, item };
  });
  const linked = checks.filter((check) => check.state !== "unlinked");
  const lacking = linked.filter((check) => check.state !== "ok");
  const availability: Availability =
    linked.length === 0 ? "unknown" : lacking.length === 0 ? (checks.some((check) => check.state === "unlinked") ? "unknown" : "ready") : lacking.length <= Math.max(1, Math.floor(linked.length / 4)) ? "almost" : "missing";
  return { availability, checks, lacking };
}

export const normalizeIngredient = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

/** Coincidencia por nombre completo; nunca inventa recetas. */
export function recipeMatches(recipe: Pick<Recipe, "ingredients">, names: string[]): number {
  const ingredients = new Set(recipe.ingredients.map((ingredient) => normalizeIngredient(ingredient.name)));
  return new Set(names.map(normalizeIngredient).filter((name) => ingredients.has(name))).size;
}

export function rankRecipes<T extends Recipe & { report: AvailabilityReport }>(recipes: T[], names: string[]): T[] {
  if (!names.length) return recipes;
  const order: Record<Availability, number> = { ready: 0, almost: 1, unknown: 2, missing: 3 };
  return recipes.filter((recipe) => recipeMatches(recipe, names) > 0).sort((a, b) =>
    recipeMatches(b, names) - recipeMatches(a, names) || order[a.report.availability] - order[b.report.availability] || a.report.lacking.length - b.report.lacking.length || a.minutes - b.minutes || a.name.localeCompare(b.name));
}

/** Puntaje promedio (1 a 5), o `null` si nadie puntuó. */
export function averageRating(ratings: (number | undefined)[]): { average: number; count: number } | null {
  const valid = ratings.filter((rating): rating is number => typeof rating === "number" && rating >= 1 && rating <= 5);
  if (valid.length === 0) return null;
  return { average: valid.reduce((sum, rating) => sum + rating, 0) / valid.length, count: valid.length };
}

/** Identidad estable durante la revisión, aunque cambie el orden de la receta. */
export const ingredientCheckKey = (check: IngredientCheck) => JSON.stringify([check.ingredient.itemId ?? "", check.ingredient.name, check.ingredient.unit]);

export interface RecipeShareLabels {
  minutes: (count: number) => string;
  servings: (count: number) => string;
  ingredients: string;
  steps: string;
  formatQty: (quantity: number, unit: string) => string;
}

/** Formatea una receta como texto plano limpio para compartir por portapapeles o mensajería. */
export function formatRecipeShareText(
  recipe: Pick<Recipe, "name" | "minutes" | "steps">,
  checks: IngredientCheck[],
  portions: number,
  labels: RecipeShareLabels,
): string {
  const lines: string[] = [];
  lines.push(`*${recipe.name}*`);
  const details: string[] = [];
  if (recipe.minutes > 0) details.push(labels.minutes(recipe.minutes));
  details.push(labels.servings(portions));
  lines.push(details.join(" · "));
  lines.push("");
  lines.push(`${labels.ingredients}:`);
  for (const check of checks) {
    const qty = labels.formatQty(check.needed, check.ingredient.unit);
    lines.push(`• ${qty} ${check.ingredient.name}`);
  }
  if (recipe.steps.length > 0) {
    lines.push("");
    lines.push(`${labels.steps}:`);
    recipe.steps.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step}`);
    });
  }
  return lines.join("\n");
}

export interface RecipeFilterOptions {
  wanted?: string[];
  show?: "all" | "ready";
  tags?: RecipeTag[];
  maxMinutes?: number | null;
  query?: string;
  recipeStockLink?: boolean;
}

/** Filtra y ordena recetas por disponibilidad, etiquetas, tiempo máximo y búsqueda sin tildes. */
export function filterAndRankRecipes<T extends Recipe & { report: AvailabilityReport }>(
  recipes: T[],
  filters: RecipeFilterOptions,
): T[] {
  const { wanted = [], show = "all", tags = [], maxMinutes = null, query = "", recipeStockLink = true } = filters;
  const words = normalizeIngredient(query).split(/\s+/).filter(Boolean);

  return rankRecipes(recipes, wanted).filter((recipe) => {
    if (recipeStockLink && show === "ready" && recipe.report.availability !== "ready") return false;
    if (tags.length > 0 && !tags.every((tag) => recipe.tags.includes(tag))) return false;
    if (maxMinutes && (recipe.minutes <= 0 || recipe.minutes > maxMinutes)) return false;
    if (words.length > 0) {
      const haystack = normalizeIngredient(`${recipe.name} ${recipe.ingredients.map((ingredient) => ingredient.name).join(" ")}`);
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
}
