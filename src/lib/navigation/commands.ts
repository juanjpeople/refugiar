import type { LucideIcon } from "lucide-react";
import type { useRouter } from "next/navigation";
import type { useI18n } from "@/i18n";

export interface Command {
  id: string;
  group: "recent" | "pages" | "containers" | "items" | "recipes" | "lists" | "actions";
  label: string;
  icon: LucideIcon;
  /** Texto extra para la búsqueda (no se muestra). */
  keywords?: string;
  run: () => void;
}

/** Lo que la búsqueda le pasa a cada funcionalidad. */
export interface SearchContext {
  t: ReturnType<typeof useI18n>["t"];
  router: ReturnType<typeof useRouter>;
  /** Ids de las rutas que la persona puede ver (APP_ROUTES filtradas por permiso). */
  visible: ReadonlySet<string>;
}

/** Lo que una funcionalidad aporta a la búsqueda (Ctrl+K). */
export interface FeatureSearch {
  /** Cosas puntuales que se pueden abrir: contenedores, recetas, listas… */
  entries: Command[];
  /** Acciones propias ("Anotar en la lista", "Escanear un QR"). */
  actions?: Command[];
  /** Nombre e ícono de algo visitado con `?id=`, para "Recientes". */
  recent?: (routeId: string, id: string) => { label: string; icon: LucideIcon } | undefined;
}
