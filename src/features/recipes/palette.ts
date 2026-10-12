"use client";

import { ChefHat } from "lucide-react";
import { useMemo } from "react";
import type { FeatureSearch, SearchContext } from "@/lib/navigation/commands";
import { recipeHref } from "@/lib/navigation/routes";
import { useRecipeNames } from "./hooks";

/** Recetas por nombre e ingredientes. */
export function useRecipeSearch({ router, visible }: SearchContext): FeatureSearch {
  const recipes = useRecipeNames();

  return useMemo(() => {
    const byId = new Map((recipes ?? []).map((recipe) => [recipe.id, recipe]));
    return {
      entries: visible.has("recipes")
        ? (recipes ?? []).map((recipe) => ({
            id: `recipe:${recipe.id}`,
            group: "recipes" as const,
            label: recipe.name,
            icon: ChefHat,
            keywords: recipe.keywords,
            run: () => router.push(recipeHref(recipe.id)),
          }))
        : [],
      recent: (routeId, id) => {
        const recipe = routeId === "recipe" ? byId.get(id) : undefined;
        return recipe && { label: recipe.name, icon: ChefHat };
      },
    };
  }, [recipes, visible, router]);
}
