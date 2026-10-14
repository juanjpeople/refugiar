"use client";

import { usePathname } from "next/navigation";
import { BottomBar, type BottomBarItem } from "@/components/ui";
import { useT } from "@/i18n";
import { findRoute, getRouteTrail } from "@/lib/navigation/routes";
import { useVisibleRoutes } from "./Navigation";

/** Lo de todos los días, en el orden de la barra. Escanear va en el centro. */
const BAR_ROUTES = ["home", "inventory", "compras", "calendar"];
/** Pantallas de cámara: ocupan todo y tienen sus propios botones abajo. */
const HIDDEN_ON = new Set(["scan", "camera"]);

/** Barra de abajo del celular (solo < md, fuera de la cámara). Respeta los permisos de cada perfil. */
export function MobileBar() {
  const t = useT();
  const pathname = usePathname();
  const routes = useVisibleRoutes();
  const current = findRoute(pathname);

  const byId = new Map(routes.map((route) => [route.id, route]));
  const items: BottomBarItem[] = BAR_ROUTES.flatMap((id) => {
    const route = byId.get(id);
    return route ? [{ id: route.id, href: route.href, label: t(route.labelKey), icon: route.icon }] : [];
  });
  const scan = byId.get("scan");
  // El activo es la sección de arriba: una caja o un lugar marcan Inventario.
  // Inicio solo cuando estás en Inicio: Escuela o Familia no marcan nada.
  const activeId = current?.id === "home" ? "home" : getRouteTrail(current).reverse().find((route) => route.id !== "home" && BAR_ROUTES.includes(route.id))?.id;

  return (
    <BottomBar
      aria-label={t("nav.bottomBar")}
      items={items}
      activeId={activeId}
      action={scan ? { id: scan.id, href: scan.href, label: t(scan.labelKey), icon: scan.icon } : undefined}
    />
  );
}

/** Pantallas donde la barra no aparece (el contenido no necesita dejarle lugar). */
export function useMobileBarVisible() {
  const current = findRoute(usePathname());
  return !(current && HIDDEN_ON.has(current.id));
}
