import { expandEvents, isForViewer } from "@/features/calendar/domain";
import { recordActivity, pruneActivity } from "@/features/activity/service";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { createId } from "@/lib/id";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { canSee } from "@/lib/sync/scope";
import { checkAvailability, RECIPE_LIMITS, type Recipe } from "./domain";
import { LIST_TABLES } from "@/features/shopping/service";
import { addReportMissingWithin } from "./service";

export async function planMeal(actor: Actor | null, recipeId: string, start: number, servings: number, cookId?: string) {
  assertCan(actor, "calendar.manage");
  assertCan(actor, "recipes.view");
  if (!Number.isFinite(start) || !Number.isInteger(servings) || servings < 1 || servings > RECIPE_LIMITS.maxServings) throw new ValidationError("errors.validation.servingsInvalid");
  await db.transaction("rw", db.events, db.recipes, db.activity, async () => {
    const recipe = await db.recipes.get(recipeId);
    if (!recipe || !canSee(actor, recipe)) throw new NotFoundError("errors.notFound.recipe");
    const id = createId();
    await db.events.add({ id, title: recipe.name, start, end: start, allDay: true, repeat: "none", participantIds: cookId ? [cookId] : [], color: "orange", privacy: recipe.privacy ?? "family", meal: { recipeId, servings, cookId }, createdBy: actor.id, createdAt: Date.now(), updatedAt: Date.now() });
    await recordActivity(actor, { module: "calendar", action: "create", entityId: id, entityName: recipe.name, privacy: recipe.privacy ?? "family", createdBy: actor.id });
  });
  await pruneActivity();
}

export async function plannedMeals(actor: Actor | null, from: number, to: number) {
  const events = (await db.events.toArray()).filter(event => event.meal && canSee(actor, event) && isForViewer(event, actor));
  return expandEvents(events, from, to).filter(entry => entry.start >= from).map(entry => ({ ...entry.event!, start: entry.start }));
}

/** Suma todas las porciones antes de comparar con stock: un producto se cuenta una sola vez. */
export async function plannedNeeds(actor: Actor | null, from: number, to: number) {
  assertCan(actor, "inventory.view");
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 8 * 86400000) throw new ValidationError("errors.validation.dateInvalid");
  const events = await plannedMeals(actor, from, to);
  const recipes = await db.recipes.bulkGet(events.map(event => event.meal!.recipeId));
  const ingredients = recipes.flatMap((recipe, index) => recipe && canSee(actor, recipe) ? recipe.ingredients.map(ingredient => ({ ...ingredient, quantity: ingredient.quantity * events[index].meal!.servings / recipe.servings })) : []);
  const items = new Map((await db.inventory.toArray()).map(item => [item.id, item]));
  const combined: Recipe = { id: "weekly", name: "", ingredients, servings: 1, steps: [], minutes: 0, tags: [], createdBy: actor.id, createdAt: 0, updatedAt: 0 };
  return checkAvailability(combined, items, 1);
}

export async function addPlannedMissing(actor: Actor | null, from: number, to: number, selected: string[]) {
  assertCan(actor, "shopping.manage");
  const added = await db.transaction("rw", [db.events, db.recipes, ...LIST_TABLES()], async () => {
    const report = await plannedNeeds(actor, from, to);
    return addReportMissingWithin(actor, report, selected);
  });
  await pruneActivity();
  return added;
}

export interface MealSuggestion {
  dayStart: number;
  recipeId: string;
  recipeName: string;
  servings: number;
  availableIngredients: number;
  totalIngredients: number;
}

/**
 * Sugiere recetas para los días de la semana que aún no tienen una comida planificada.
 * Prioriza recetas que tengan todos o la mayoría de sus ingredientes en el inventario.
 */
export async function suggestWeeklyMenu(actor: Actor | null, from: number, to: number): Promise<MealSuggestion[]> {
  assertCan(actor, "calendar.manage");
  assertCan(actor, "recipes.view");
  const planned = await plannedMeals(actor, from, to);
  const plannedDays = new Set(planned.map((e) => Math.floor(e.start / 86400000)));

  const emptyDays: number[] = [];
  for (let t = from; t < to; t += 86400000) {
    const dayKey = Math.floor(t / 86400000);
    if (!plannedDays.has(dayKey)) {
      emptyDays.push(t);
    }
  }

  if (emptyDays.length === 0) return [];

  const allRecipes = (await db.recipes.toArray()).filter((r) => canSee(actor, r));
  if (allRecipes.length === 0) return [];

  const inventoryItems = new Map((await db.inventory.toArray()).map((item) => [item.id, item]));

  const scoredRecipes = allRecipes.map((recipe) => {
    const report = checkAvailability(recipe, inventoryItems, recipe.servings);
    const available = report.checks.filter((c) => c.state === "ok").length;
    const total = report.checks.length;
    const score = total > 0 ? available / total : 1;
    return { recipe, score, available, total };
  });

  scoredRecipes.sort((a, b) => b.score - a.score || b.recipe.updatedAt - a.recipe.updatedAt);

  const suggestions: MealSuggestion[] = [];
  for (let i = 0; i < emptyDays.length; i++) {
    const candidate = scoredRecipes[i % scoredRecipes.length];
    suggestions.push({
      dayStart: emptyDays[i],
      recipeId: candidate.recipe.id,
      recipeName: candidate.recipe.name,
      servings: candidate.recipe.servings || 4,
      availableIngredients: candidate.available,
      totalIngredients: candidate.total,
    });
  }

  return suggestions;
}
