"use client";

import type { FeatureSearch, SearchContext } from "@/lib/navigation/commands";
import { useProjectSearch } from "./projects/palette";
import { useRecipeSearch } from "./recipes/palette";
import { useShoppingSearch } from "./shopping/palette";
import { useStorageSearch } from "./storage/palette";

/**
 * Registro de funcionalidades. El shell (menú, migas, búsqueda, recientes) no conoce ninguna
 * funcionalidad en particular: lee las rutas de `APP_ROUTES` y la búsqueda de acá.
 *
 * Para sumar una funcionalidad:
 * 1. Sus páginas en `APP_ROUTES` (`src/lib/navigation/routes.ts`): ruta, ícono, permiso, sección.
 * 2. Si tiene cosas que buscar, un `use<Nombre>Search` en `features/<nombre>/palette.ts`, sumado acá.
 * 3. Sus pantallas con `ListPage` y `DetailPage` (ver `/design` → Plantillas).
 *
 * El orden de esta lista es el orden de los grupos en la búsqueda.
 */
export function useFeatureSearch(context: SearchContext): FeatureSearch[] {
  return [useStorageSearch(context), useRecipeSearch(context), useShoppingSearch(context), useProjectSearch(context)];
}
