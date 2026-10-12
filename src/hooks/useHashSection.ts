"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

const LOCAL_CHANGE = "od-hash-section";

function subscribe(onChange: () => void) {
  let queued = false;
  // Next.js cambia el historial en useInsertionEffect (un Link a `#datos`): notificar fuera de esa fase.
  const notify = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      onChange();
    });
  };
  // Un Link de Next con solo el hash no dispara `hashchange`: la Navigation API sí avisa.
  const navigation = (window as Window & { navigation?: EventTarget }).navigation;
  navigation?.addEventListener("currententrychange", notify);
  window.addEventListener("hashchange", notify);
  window.addEventListener("popstate", notify);
  window.addEventListener(LOCAL_CHANGE, notify);
  return () => {
    navigation?.removeEventListener("currententrychange", notify);
    window.removeEventListener("hashchange", notify);
    window.removeEventListener("popstate", notify);
    window.removeEventListener(LOCAL_CHANGE, notify);
  };
}

const getHash = () => decodeURIComponent(window.location.hash.slice(1));

/**
 * La sección abierta vive en el hash (`/ajustes#datos`): los enlaces llevan directo a ella y
 * "atrás" del navegador vuelve a la anterior. `null` si el hash no nombra ninguna de `ids`.
 */
export function useHashSection(ids: readonly string[]) {
  const hash = useSyncExternalStore(subscribe, getHash, () => "");
  const active = ids.includes(hash) ? hash : null;
  // Si se abrió desde la lista, volver es "atrás"; si se llegó por un enlace, volver muestra la lista.
  const openedFromList = useRef(false);

  const select = useCallback((id: string) => {
    openedFromList.current = !getHash();
    window.history.pushState(window.history.state, "", `${window.location.pathname}${window.location.search}#${id}`);
    window.dispatchEvent(new Event(LOCAL_CHANGE));
  }, []);

  const back = useCallback(() => {
    if (openedFromList.current) {
      openedFromList.current = false;
      window.history.back();
      return;
    }
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    window.dispatchEvent(new Event(LOCAL_CHANGE));
  }, []);

  return { active, select, back };
}
