"use client";

import { Languages, LogOut, Monitor, Moon, PanelLeft, PanelLeftClose, PanelLeftDashed, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useFeatureSearch } from "@/features/registry";
import { useSetPreference } from "@/hooks/usePreferences";
import { LOCALE_META, LOCALES, useI18n } from "@/i18n";
import { useCurrentUser, useSessionStore } from "@/lib/auth/session";
import type { Command } from "@/lib/navigation/commands";
import { findRoute } from "@/lib/navigation/routes";
import { useNavigationStore } from "@/store/useNavigationStore";
import { useVisibleRoutes } from "./Navigation";

export type { Command } from "@/lib/navigation/commands";

/**
 * Comandos de la búsqueda (Ctrl+K): recientes, páginas, lo que aporta cada funcionalidad
 * (`useFeatureSearch`, en `features/registry.ts`) y las acciones generales. La paleta los
 * filtra, ordena y ejecuta sin cambios.
 */
export function useCommands(): Command[] {
  const router = useRouter();
  const { t, locale } = useI18n();
  const user = useCurrentUser();
  const routes = useVisibleRoutes();
  const setPreference = useSetPreference();
  const signOut = useSessionStore((s) => s.signOut);
  const recent = useNavigationStore((s) => (user ? s.recent[user.id] : undefined));
  const visible = useMemo(() => new Set(routes.map((route) => route.id)), [routes]);
  const features = useFeatureSearch({ t, router, visible });

  return useMemo(() => {
    // Un reciente puede ser una página o algo puntual con `?id=` (un contenedor, una receta, un proyecto).
    const recentCommands: Command[] = (recent ?? []).flatMap((visit): Command[] => {
      const [path, query = ""] = visit.href.split("?");
      const route = findRoute(path);
      if (!route || !visible.has(route.id)) return [];
      if (route.needsId) {
        const id = new URLSearchParams(query).get("id") ?? "";
        const found = features.map((feature) => feature.recent?.(route.id, id)).find(Boolean);
        return found ? [{ id: `recent:${visit.href}`, group: "recent", ...found, run: () => router.push(visit.href) }] : [];
      }
      return [{ id: `recent:${visit.href}`, group: "recent", label: t(route.labelKey), icon: route.icon, run: () => router.push(route.href) }];
    }).slice(0, 4);

    const pageCommands: Command[] = routes.filter((route) => !route.needsId && !(route.external && route.hidden)).map((route) => ({
      id: `page:${route.id}`,
      group: "pages",
      label: t(route.labelKey),
      icon: route.icon,
      keywords: route.href,
      run: () => router.push(route.href),
    }));

    const actionCommands: Command[] = [
      ...features.flatMap((feature) => feature.actions ?? []),
      { id: "theme:light", group: "actions", label: t("palette.actions.themeLight"), icon: Sun, run: () => setPreference("themeMode", "light") },
      { id: "theme:dark", group: "actions", label: t("palette.actions.themeDark"), icon: Moon, run: () => setPreference("themeMode", "dark") },
      { id: "theme:system", group: "actions", label: t("palette.actions.themeSystem"), icon: Monitor, run: () => setPreference("themeMode", "system") },
      ...LOCALES.filter((code) => code !== locale).map<Command>((code) => ({
        id: `locale:${code}`,
        group: "actions",
        label: t("palette.actions.language", { language: LOCALE_META[code].label }),
        icon: Languages,
        keywords: "idioma language",
        run: () => setPreference("locale", code),
      })),
      { id: "sidebar:expanded", group: "actions", label: t("palette.actions.sidebarExpanded"), icon: PanelLeft, run: () => setPreference("sidebar", "expanded") },
      { id: "sidebar:collapsed", group: "actions", label: t("palette.actions.sidebarCollapsed"), icon: PanelLeftClose, run: () => setPreference("sidebar", "collapsed") },
      { id: "sidebar:hidden", group: "actions", label: t("palette.actions.sidebarHidden"), icon: PanelLeftDashed, run: () => setPreference("sidebar", "hidden") },
      { id: "session:signout", group: "actions", label: t("palette.actions.signOut"), icon: LogOut, run: signOut },
    ];

    return [...recentCommands, ...pageCommands, ...features.flatMap((feature) => feature.entries), ...actionCommands];
  }, [routes, visible, recent, features, t, locale, router, setPreference, signOut]);
}
