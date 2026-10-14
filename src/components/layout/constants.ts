import type { SidebarMode } from "@/store/usePreferencesStore";

/** Ancho del menú lateral por modo (px). */
export const SIDEBAR_WIDTH: Record<SidebarMode, number> = { expanded: 240, collapsed: 72, hidden: 0 };

/** Variable CSS con el alto real de la barra fija de arriba (la mide AppShell). */
export const HEADER_HEIGHT_VAR = "--od-header-height";

/**
 * `top` de algo pegajoso (o `scrollMarginTop` de un ancla) para que frene justo debajo de la barra
 * fija, aunque las migas bajen de renglón en un celular. `gap` es el aire extra en px.
 */
export const belowHeader = (gap = 0) => `calc(var(${HEADER_HEIGHT_VAR}, 80px) + ${gap}px)`;
