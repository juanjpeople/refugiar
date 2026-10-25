"use client";

import { App } from "antd";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import type { InventoryItem } from "@/features/inventory/domain";
import { formatQuantity } from "@/features/inventory/format";
import { useInventoryOptions } from "@/features/shopping/hooks";
import { useI18n, useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { usePermission } from "@/lib/auth/hooks";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { canSee } from "@/lib/sync/scope";
import { averageRating, checkAvailability, filterAndRankRecipes, normalizeIngredient, RECIPE_TAGS, type AvailabilityReport, type Recipe, type RecipeInput, type RecipeTag } from "./domain";
import { addMissingToList, undoCooking, cookRecipe, createRecipe, deleteRecipe, duplicateRecipe, importRecipePack, importStarterRecipe, setRecipeCover, updateRecipe, type Consumption } from "./service";

export interface RecipeSummary extends Recipe {
  report: AvailabilityReport;
  rating: { average: number; count: number } | null;
}

async function itemsById(recipes: Recipe[]) {
  const ids = [...new Set(recipes.flatMap((recipe) => recipe.ingredients.flatMap((ingredient) => (ingredient.itemId ? [ingredient.itemId] : []))))];
  return new Map((await db.inventory.bulkGet(ids)).flatMap((item): [string, InventoryItem][] => (item ? [[item.id, item]] : [])));
}

/** Todas las recetas con su disponibilidad y su puntaje. Reactivas al stock: si se acaba algo, cambia el estado. */
export function useRecipes(): RecipeSummary[] | undefined {
  const viewer = useCurrentUser();
  return useLiveQuery(async () => {
    const [all, comments] = await Promise.all([db.recipes.orderBy("name").toArray(), db.comments.where("[ownerType+ownerId]").between(["recipe", ""], ["recipe", "￿"]).toArray()]);
    const recipes = all.filter((recipe) => canSee(viewer, recipe));
    const items = await itemsById(recipes);
    return recipes.map((recipe) => ({
      ...recipe,
      report: checkAvailability(recipe, items),
      rating: averageRating(comments.filter((comment) => comment.ownerId === recipe.id).map((comment) => comment.rating)),
    }));
  }, [viewer?.id, viewer?.role]);
}

/** Nombres de las recetas para la búsqueda global (los ingredientes también encuentran: "zapallo"). */
export function useRecipeNames() {
  const viewer = useCurrentUser();
  return useLiveQuery(
    async () =>
      (await db.recipes.orderBy("name").toArray())
        .filter((recipe) => canSee(viewer, recipe))
        .map((recipe) => ({
          id: recipe.id,
          name: recipe.name,
          keywords: recipe.ingredients.map((ingredient) => ingredient.name).join(" "),
        })),
    [viewer?.id, viewer?.role],
  );
}

/** Una receta con los productos de sus ingredientes. `undefined` cargando, `null` si no existe. */
export function useRecipe(id: string | null) {
  const viewer = useCurrentUser();
  return useLiveQuery(async () => {
    if (!id) return null;
    const recipe = await db.recipes.get(id);
    if (!recipe || !canSee(viewer, recipe)) return null;
    return { recipe, items: await itemsById([recipe]) };
  }, [id, viewer?.id, viewer?.role]);
}

export function useRecipeActions() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const t = useT();

  async function run<T>(action: () => Promise<T>, success?: string): Promise<T | null> {
    try {
      const result = await action();
      if (success) message.success(success);
      return result;
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return null;
    }
  }

  return {
    create: (input: RecipeInput) => run(() => createRecipe(user, input), t("recipes.toast.created")),
    update: (id: string, input: RecipeInput) => run(() => updateRecipe(user, id, input), t("recipes.toast.saved")),
    remove: (id: string) => run(() => deleteRecipe(user, id), t("recipes.toast.deleted")),
    setCover: (id: string, photoId: string | undefined) => run(() => setRecipeCover(user, id, photoId)),
    undoCook: (id: string) => run(() => undoCooking(user, id), t("activity.undone")),
    cook: (id: string, servings: number, consumptions: Consumption[], operationId?: string) => run(() => cookRecipe(user, id, servings, consumptions, operationId)),
    addMissing: (id: string, servings: number, selected?: string[]) => run(() => addMissingToList(user, id, servings, selected)),
    duplicate: (id: string, newName?: string) => run(() => duplicateRecipe(user, id, newName), t("recipes.toast.duplicated")),
    importPack: (packId: string) => run(() => importRecipePack(user, packId)),
    importStarter: (recipeId: string) => run(() => importStarterRecipe(user, recipeId)),
  };
}

export type RecipeShowFilter = "all" | "ready";

/** Encapsula la lectura de filtros URL, stock disponible y filtrado del catálogo de recetas. */
export function useRecipeCatalogFilters(recipes: RecipeSummary[] | undefined, recipeStockLink: boolean) {
  const { t, format } = useI18n();
  const params = useSearchParams();
  const show: RecipeShowFilter = params.get("show") === "ready" ? "ready" : "all";
  const tags = params.getAll("tag").filter((tag): tag is RecipeTag => RECIPE_TAGS.includes(tag as RecipeTag));
  const query = params.get("q") ?? "";
  const wanted = params.getAll("use");
  const timeParam = params.get("time");
  const maxMinutes = timeParam ? Number.parseInt(timeParam, 10) : null;

  function setFilter(key: string, values: string[]) {
    const next = new URL(window.location.href);
    next.searchParams.delete(key);
    for (const value of values.filter(Boolean)) next.searchParams.append(key, value);
    window.history.replaceState(null, "", `${next.pathname}${next.search}${next.hash}`);
  }

  const setShow = (value: RecipeShowFilter) => setFilter("show", value === "all" ? [] : [value]);
  const setQuery = (value: string) => setFilter("q", [value]);
  const setWanted = (values: string[]) => setFilter("use", [...new Map(values.map((value) => [normalizeIngredient(value), value.trim()])).values()]);

  const canViewInventory = usePermission("inventory.view");
  const inventory = useInventoryOptions(canViewInventory);
  const pantry = canViewInventory ? (inventory ?? []).filter(({ item }) => !item.reusable && item.quantity > 0) : [];
  const names = new Map((recipes ?? []).flatMap((recipe) => recipe.ingredients.map((ingredient) => [normalizeIngredient(ingredient.name), ingredient.name] as const)));
  for (const { item } of pantry) names.set(normalizeIngredient(item.name), item.name);

  const options = [...names.values()].map((name) => {
    if (!recipeStockLink) {
      return { value: name, label: name, available: false };
    }
    const matches = pantry.filter(({ item }) => normalizeIngredient(item.name) === normalizeIngredient(name));
    const stock = matches.map(({ item, place }) => `${formatQuantity(t, item.quantity, item.unit, format.number)} · ${place}`).join("; ");
    return { value: name, label: stock ? `${name} — ${stock}` : name, available: matches.length > 0 };
  }).sort((a, b) => (recipeStockLink ? Number(b.available) - Number(a.available) : 0) || a.value.localeCompare(b.value));

  const visible = filterAndRankRecipes(recipes ?? [], {
    wanted,
    show,
    tags,
    maxMinutes,
    query,
    recipeStockLink,
  });

  const readyCount = recipes?.filter((recipe) => recipe.report.availability === "ready").length ?? 0;
  const usedTags = RECIPE_TAGS.filter((tag) => recipes?.some((recipe) => recipe.tags.includes(tag)));

  return {
    show,
    setShow,
    tags,
    query,
    setQuery,
    wanted,
    setWanted,
    timeParam,
    setFilter,
    pantry,
    options,
    visible,
    readyCount,
    usedTags,
  };
}
