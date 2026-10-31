"use client";

import { Grid } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { useT } from "@/i18n";
import { isSecured } from "@/features/members/domain";
import { useCurrentUser, useLockStore } from "@/lib/auth/session";
import { findRoute } from "@/lib/navigation/routes";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";
import { useNavigationStore, useUiStore } from "@/store/useNavigationStore";
import { persistStorage } from "@/features/cloud/diagnostics";
import { useDeviceStore } from "@/store/useDeviceStore";
import { DEMO_ENABLED } from "@/lib/demo";
import { isAndroidApp } from "@/lib/platform";
import { sendPulse } from "@/lib/cloud/pulse";

/**
 * Botón de menú: en escritorio alterna completo ↔ solo íconos; si el menú está oculto
 * (o en mobile), abre el Drawer.
 */
export function useToggleSidebar() {
  const screens = Grid.useBreakpoint();
  const { sidebar } = usePreferences();
  const setPreference = useSetPreference();
  const setNavDrawerOpen = useUiStore((s) => s.setNavDrawerOpen);
  const usesDrawer = sidebar === "hidden";
  const router = useRouter();

  return useCallback(() => {
    if (!screens.md) router.push("/mas");
    else if (usesDrawer) setNavDrawerOpen(true);
    else setPreference("sidebar", sidebar === "expanded" ? "collapsed" : "expanded");
  }, [screens.md, router, usesDrawer, sidebar, setPreference, setNavDrawerOpen]);
}

/** Atajos globales: Ctrl/⌘+K búsqueda, Ctrl/⌘+B menú, Ctrl/⌘+, ajustes. */
export function useGlobalShortcuts() {
  const router = useRouter();
  const toggleSidebar = useToggleSidebar();
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setPaletteOpen(!useUiStore.getState().paletteOpen);
      } else if (key === "b") {
        event.preventDefault();
        toggleSidebar();
      } else if (key === ",") {
        event.preventDefault();
        router.push("/ajustes");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, toggleSidebar, setPaletteOpen]);
}

/** Registra cada página visitada (para "Recientes") y pone el título de la pestaña en el idioma activo. */
export function useNavigationTracking() {
  const t = useT();
  const pathname = usePathname();
  const user = useCurrentUser();
  const visit = useNavigationStore((s) => s.visit);
  const tail = useBreadcrumbStore((s) => s.tail);
  const route = findRoute(pathname);

  useEffect(() => {
    sendPulse(DEMO_ENABLED ? "demo_open" : isAndroidApp() ? "android_boot" : "pwa_boot");
  }, []);

  useEffect(() => {
    if (!pathname) return;
    if (pathname === "/") sendPulse("module:dashboard");
    else if (pathname.startsWith("/recetas")) sendPulse("module:recipes");
    else if (pathname.startsWith("/inventario")) sendPulse("module:inventory");
    else if (pathname.startsWith("/compras")) sendPulse("module:shopping");
    else if (pathname.startsWith("/proyectos")) sendPulse("module:projects");
    else if (pathname.startsWith("/calendario")) sendPulse("module:calendar");
    else if (pathname.startsWith("/mascotas")) sendPulse("module:pets");
    else if (pathname.startsWith("/familia") || pathname.startsWith("/escuela")) sendPulse("module:family");
  }, [pathname]);

  // Las páginas con `?id=` registran su visita ellas mismas (ver `useTrackVisit`), con el id.
  useEffect(() => {
    if (user && route && !route.needsId) visit(user.id, pathname);
  }, [user, route, pathname, visit]);

  useEffect(() => {
    if (route) document.title = `${tail.at(-1)?.label ?? t(route.labelKey)} · ${t("common.appName")}`;
  }, [route, tail, t]);
}

/**
 * Bloqueo por inactividad para perfiles protegidos. También al volver a la pestaña o recargar
 * después del tiempo configurado (la última actividad vive en sessionStorage).
 */
export function useAutoLock() {
  const user = useCurrentUser();
  const { autoLockMinutes } = usePreferences();
  const touch = useLockStore((s) => s.touch);
  const lock = useLockStore((s) => s.lock);
  const secured = !!user && isSecured(user);

  useEffect(() => {
    if (!secured || autoLockMinutes === 0) return;
    const limit = autoLockMinutes * 60_000;
    let lastTouch = 0;
    const onActivity = () => {
      const now = Date.now();
      // Como mucho una escritura cada 10 s: la actividad es muy frecuente.
      if (now - lastTouch > 10_000) {
        lastTouch = now;
        touch();
      }
    };
    const check = () => {
      if (Date.now() - useLockStore.getState().lastActivity > limit) lock();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", check);
    const interval = setInterval(check, 15_000);
    check();
    return () => {
      events.forEach((name) => window.removeEventListener(name, onActivity));
      document.removeEventListener("visibilitychange", check);
      clearInterval(interval);
    };
  }, [secured, autoLockMinutes, touch, lock]);
}

/**
 * Para páginas con `?id=` (contenedor, receta, proyecto): registran en "Recientes" la URL completa,
 * así se vuelve a lo exacto. `null` mientras no hay datos (no se registra lo que no existe).
 */
export function useTrackVisit(href: string | null) {
  const user = useCurrentUser();
  const visit = useNavigationStore((s) => s.visit);
  useEffect(() => {
    if (user && href) visit(user.id, href);
  }, [user, href, visit]);
}

/**
 * Casa solo en este dispositivo: pide al navegador que no borre sus datos (ni las fotos) cuando le
 * falta espacio o pasan días sin visitas. Chrome lo concede si la app está instalada o se usa seguido;
 * Safari en iPhone solo lo respeta con la app agregada a la pantalla de inicio.
 */
export function useKeepLocalData() {
  const mode = useDeviceStore((s) => s.mode);
  useEffect(() => {
    if (mode === "local") void persistStorage();
  }, [mode]);
}
