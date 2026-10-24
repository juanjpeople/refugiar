/**
 * Servicio de recetas: ÚNICO punto que las escribe. "Cociné esto" descuenta los ingredientes
 * con las reglas del inventario, y "Agregar lo que falta" anota con las de la lista de compras,
 * cada uno en una sola transacción (todo o nada).
 */
import { isUndoable } from "@/features/activity/domain";
import { closeSource } from "@/features/sharing/service";
import { pruneActivity, recordActivity, setActivityPrivacy } from "@/features/activity/service";
import { deleteCommentsOfWithin } from "@/features/comments/service";
import { consumeWithin, undoQuantityChange, QUANTITY_TABLES } from "@/features/inventory/service";
import { deletePhotosOfWithin } from "@/features/media/service";
import { INVENTORY_LIMITS } from "@/features/inventory/domain";
import { roundQuantity } from "@/features/inventory/quantity";
import { HOME_LIST_ID } from "@/features/shopping/domain";
import { addToListWithin, LIST_TABLES } from "@/features/shopping/service";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { canSee } from "@/lib/sync/scope";
import { createId } from "@/lib/id";
import { checkAvailability, ingredientCheckKey, normalizeIngredient, parseRecipe, RECIPE_LIMITS, type RecipeInput, type AvailabilityReport } from "./domain";
import { RECIPE_PACKS } from "./packs";

async function getRecipe(id: string) {
  const recipe = await db.recipes.get(id);
  if (!recipe) throw new NotFoundError("errors.notFound.recipe");
  return recipe;
}

export async function createRecipe(actor: Actor | null, input: RecipeInput) {
  assertCan(actor, "recipes.manage");
  const data = parseRecipe(input);
  const id = createId();
  const now = Date.now();
  await db.transaction("rw", db.recipes, db.activity, async () => {
    await db.recipes.add({ ...data, id, createdBy: actor.id, createdAt: now, updatedAt: now });
    await recordActivity(actor, { module: "recipes", action: "create", entityId: id, entityName: data.name, privacy: data.privacy, createdBy: actor.id });
  });
  await pruneActivity();
  return id;
}

export async function updateRecipe(actor: Actor | null, id: string, input: RecipeInput) {
  assertCan(actor, "recipes.manage");
  const data = parseRecipe(input);
  await db.transaction("rw", db.recipes, db.activity, db.events, async () => {
    const recipe = await getRecipe(id);
    if (!canSee(actor, recipe)) throw new NotFoundError("errors.notFound.recipe");
    for (const event of await db.events.filter(event => event.meal?.recipeId === id).toArray()) {
      const privacy = data.privacy === "private" ? "private" : event.privacy === "private" ? "private" : data.privacy === "adults" ? "adults" : event.privacy ?? "family";
      const createdBy = data.privacy === "private" ? recipe.createdBy : event.createdBy;
      await db.events.update(event.id, { title: data.name, privacy, createdBy, updatedAt: Date.now() });
      await setActivityPrivacy("calendar", event.id, privacy, createdBy);
    }
    await setActivityPrivacy("recipes", id, data.privacy, recipe.createdBy);
    await db.recipes.update(id, { ...data, updatedAt: Date.now() });
    await recordActivity(actor, { module: "recipes", action: "update", entityId: id, entityName: data.name, privacy: data.privacy, createdBy: recipe.createdBy });
  });
}

/** Elige la portada entre las fotos de la receta. */
export async function setRecipeCover(actor: Actor | null, id: string, photoId: string | undefined) {
  assertCan(actor, "recipes.manage");
  await db.transaction("rw", db.recipes, db.photos, async () => {
    await getRecipe(id);
    if (photoId) {
      const photo = await db.photos.get(photoId);
      if (!photo || photo.ownerType !== "recipe" || photo.ownerId !== id) throw new NotFoundError("errors.notFound.photo");
    }
    await db.recipes.update(id, { coverPhotoId: photoId });
  });
}

/** Borra la receta con sus fotos y comentarios (no tienen sentido solos). */
export async function deleteRecipe(actor: Actor | null, id: string) {
  assertCan(actor, "recipes.manage");
  const before = await db.recipes.get(id);
  if (!before) return;
  if (!canSee(actor, before)) throw new NotFoundError("errors.notFound.recipe");
  await closeSource("recipe", id);
  for (const event of await db.events.filter(event => event.meal?.recipeId === id).toArray()) await closeSource("event", event.id);
  await db.transaction("rw", [db.recipes, db.photos, db.comments, db.activity, db.photoDeletes, db.events], async () => {
    const recipe = await db.recipes.get(id);
    if (!recipe) return;
    if (!canSee(actor, recipe)) throw new NotFoundError("errors.notFound.recipe");
    for (const event of await db.events.filter(event => event.meal?.recipeId === id).toArray()) {
      await setActivityPrivacy("calendar", event.id, event.privacy ?? "family", event.createdBy);
      await db.events.delete(event.id);
    }
    await setActivityPrivacy("recipes", id, recipe.privacy ?? "family", recipe.createdBy);
    await db.recipes.delete(id);
    await deletePhotosOfWithin("recipe", id);
    await deleteCommentsOfWithin("recipe", id);
    await recordActivity(actor, { module: "recipes", action: "delete", entityId: id, entityName: recipe.name, privacy: recipe.privacy ?? "family", createdBy: recipe.createdBy });
  });
}

export interface Consumption {
  itemId: string;
  amount: number;
}

/**
 * "Cociné esto": descuenta lo que se usó (la persona lo revisa y ajusta antes). Cada descuento
 * queda como consumo del producto (se puede deshacer desde el historial) y la receta, como cocinada.
 * Devuelve qué productos no alcanzaron.
 */
export async function cookRecipe(actor: Actor | null, id: string, servings: number, consumptions: Consumption[], operationId = createId()) {
  assertCan(actor, "inventory.consume");
  if (!Number.isInteger(servings) || servings < 1 || servings > RECIPE_LIMITS.maxServings) throw new ValidationError("errors.validation.servingsInvalid");
  const short: { itemId: string; missing: number }[] = [];
  await db.transaction("rw", [db.recipes, ...QUANTITY_TABLES()], async () => {
    const recipe = await getRecipe(id);
    if (!canSee(actor, recipe)) throw new NotFoundError("errors.notFound.recipe");
    // Repetir la misma confirmación no vuelve a consumir, incluso después de un cierre.
    if (await db.activity.get(operationId)) return;
    const consumptionIds: string[] = [];
    const amounts = new Map<string, number>();
    for (const { itemId, amount } of consumptions) {
      if (!Number.isFinite(amount) || amount < 0) throw new ValidationError("errors.validation.quantityInvalid");
      amounts.set(itemId, roundQuantity((amounts.get(itemId) ?? 0) + amount));
    }
    for (const [itemId, amount] of amounts) {
      if (amount === 0) continue;
      if (!(await db.inventory.get(itemId))) throw new NotFoundError("errors.notFound.item");
      const plan = await consumeWithin(actor, itemId, amount);
      if (plan?.entryId) consumptionIds.push(plan.entryId);
      if (plan && plan.missing > 0) short.push({ itemId, missing: plan.missing });
    }
    await recordActivity(actor, { module: "recipes", action: "cooked", entityId: id, entityName: recipe.name, to: servings, consumptionIds, privacy: recipe.privacy ?? "family", createdBy: recipe.createdBy }, operationId);
  });
  await pruneActivity();
  return short;
}

/** Anota en la lista lo que falta para cocinarla (incluye ingredientes sin vínculo confirmados por la persona). */
export async function addMissingToList(actor: Actor | null, id: string, servings: number, selected?: string[]) {
  assertCan(actor, "shopping.manage");
  if (!Number.isInteger(servings) || servings < 1 || servings > RECIPE_LIMITS.maxServings) throw new ValidationError("errors.validation.servingsInvalid");
  let added = 0;
  await db.transaction("rw", [db.recipes, ...LIST_TABLES()], async () => {
    const recipe = await getRecipe(id);
    const itemIds = recipe.ingredients.flatMap((ingredient) => (ingredient.itemId ? [ingredient.itemId] : []));
    const items = new Map((await db.inventory.bulkGet(itemIds)).flatMap((item) => (item ? [[item.id, item] as const] : [])));
    const report = checkAvailability(recipe, items, servings);
    added = await addReportMissingWithin(actor, report, selected);
  });
  await pruneActivity();
  return added;
}

/** Reutilizado por una receta y el menú semanal, dentro de la transacción de compras. */
export async function addReportMissingWithin(actor: Actor, report: AvailabilityReport, selected?: string[]) {
  let added = 0;
  const pending = await db.shoppingList.where("[listId+status]").equals([HOME_LIST_ID, "pending"]).toArray();
  const candidates = report.checks.filter((check) => check.state !== "ok" && (selected ? selected.includes(ingredientCheckKey(check)) : check.state !== "unlinked"));
  for (const check of candidates) {
    const item = check.item;
    const name = item?.name ?? check.ingredient.name;
    const unit = item?.unit ?? check.ingredient.unit;
    const already = pending.filter((entry) => entry.unit === unit && (item ? entry.inventoryItemId === item.id : !entry.inventoryItemId && normalizeIngredient(entry.name) === normalizeIngredient(name))).reduce((sum, entry) => sum + entry.quantity, 0);
    const quantity = roundQuantity(check.needed - (check.have ?? 0) - already);
    if (quantity <= 0) continue;
    await addToListWithin(actor, { name, quantity, unit, inventoryItemId: item?.id });
    added++;
  }
  return added;
}

/** Todo o nada; los consumos deshechos individualmente no se devuelven otra vez. */
export async function undoCooking(actor: Actor | null, entryId: string) {
  assertCan(actor, "inventory.adjust");
  await db.transaction("rw", QUANTITY_TABLES(), async () => {
    const entry = await db.activity.get(entryId);
    if (!entry || entry.module !== "recipes" || !isUndoable(entry, Date.now()) || !canSee(actor, entry)) throw new ValidationError("errors.activity.notUndoable");
    for (const id of entry.consumptionIds ?? []) {
      const consumption = await db.activity.get(id);
      if (!consumption) throw new ValidationError("errors.activity.notUndoable");
      if (consumption.undoneAt === undefined) {
        const item = await db.inventory.get(consumption.entityId);
        if (!item || item.unit !== consumption.unit || item.quantity + (consumption.from! - consumption.to!) > INVENTORY_LIMITS.maxQuantity) throw new ValidationError("errors.activity.notUndoable");
        await undoQuantityChange(actor, id);
      }
    }
    await db.activity.update(entryId, { undoneAt: Date.now(), undoneBy: actor.name });
  });
}

/** Importa un pack de recetas temáticas a la casa sin duplicar las que ya existan. */
export async function importRecipePack(actor: Actor | null, packId: string): Promise<number> {
  assertCan(actor, "recipes.manage");
  const pack = RECIPE_PACKS.find((p) => p.id === packId);
  if (!pack) throw new NotFoundError("errors.notFound.recipe");
  const now = Date.now();
  let imported = 0;
  await db.transaction("rw", db.recipes, db.activity, async () => {
    for (const item of pack.recipes) {
      const existing = await db.recipes.get(item.id);
      if (existing) continue;
      const byName = await db.recipes.filter((r) => normalizeIngredient(r.name) === normalizeIngredient(item.name)).first();
      if (byName) continue;
      const data = parseRecipe({
        name: item.name,
        servings: item.servings,
        minutes: item.minutes,
        ingredients: item.ingredients,
        steps: item.steps,
        stepSeconds: item.stepSeconds,
        tags: item.tags,
        privacy: "family",
      });
      await db.recipes.add({ ...data, id: item.id, createdBy: actor?.id ?? "local", createdAt: now, updatedAt: now });
      await recordActivity(actor, { module: "recipes", action: "create", entityId: item.id, entityName: data.name, privacy: data.privacy, createdBy: actor?.id ?? "local" });
      imported++;
    }
  });
  if (imported > 0) await pruneActivity();
  return imported;
}

/** Importa una única receta de ejemplo a la casa. */
export async function importStarterRecipe(actor: Actor | null, recipeId: string): Promise<string | null> {
  assertCan(actor, "recipes.manage");
  const allRecipes = RECIPE_PACKS.flatMap((p) => p.recipes);
  const item = allRecipes.find((r) => r.id === recipeId);
  if (!item) throw new NotFoundError("errors.notFound.recipe");
  const now = Date.now();
  let createdId: string | null = null;
  await db.transaction("rw", db.recipes, db.activity, async () => {
    const existing = await db.recipes.get(item.id);
    if (existing) return;
    const byName = await db.recipes.filter((r) => normalizeIngredient(r.name) === normalizeIngredient(item.name)).first();
    if (byName) return;
    const data = parseRecipe({
      name: item.name,
      servings: item.servings,
      minutes: item.minutes,
      ingredients: item.ingredients,
      steps: item.steps,
      stepSeconds: item.stepSeconds,
      tags: item.tags,
      privacy: "family",
    });
    await db.recipes.add({ ...data, id: item.id, createdBy: actor?.id ?? "local", createdAt: now, updatedAt: now });
    await recordActivity(actor, { module: "recipes", action: "create", entityId: item.id, entityName: data.name, privacy: data.privacy, createdBy: actor?.id ?? "local" });
    createdId = item.id;
  });
  if (createdId) await pruneActivity();
  return createdId;
}

/** Clona una receta existente para crear una variante personal editable. */
export async function duplicateRecipe(actor: Actor | null, id: string, newName?: string): Promise<string> {
  assertCan(actor, "recipes.manage");
  const source = await getRecipe(id);
  if (!canSee(actor, source)) throw new NotFoundError("errors.notFound.recipe");
  const newId = createId();
  const now = Date.now();
  const name = newName?.trim() || `${source.name} (variante)`;
  const data = parseRecipe({
    name,
    servings: source.servings,
    minutes: source.minutes,
    ingredients: source.ingredients,
    steps: source.steps,
    stepSeconds: source.stepSeconds,
    tags: source.tags,
    privacy: source.privacy ?? "family",
  });
  await db.transaction("rw", db.recipes, db.activity, async () => {
    await db.recipes.add({ ...data, id: newId, createdBy: actor?.id ?? "local", createdAt: now, updatedAt: now });
    await recordActivity(actor, { module: "recipes", action: "create", entityId: newId, entityName: data.name, privacy: data.privacy, createdBy: actor?.id ?? "local" });
  });
  await pruneActivity();
  return newId;
}
