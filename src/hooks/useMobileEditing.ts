"use client";

import { useSyncExternalStore } from "react";

function editing() {
  const element = document.activeElement;
  return element instanceof HTMLElement && (element.isContentEditable || element.matches("textarea, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range])"));
}

function subscribe(change: () => void) {
  // El foco se actualiza después de focusout: agrupar ambos eventos evita un parpadeo.
  const update = () => queueMicrotask(change);
  document.addEventListener("focusin", update);
  document.addEventListener("focusout", update);
  return () => {
    document.removeEventListener("focusin", update);
    document.removeEventListener("focusout", update);
  };
}

/** Durante la edición, dejar espacio al teclado y a las acciones del formulario. */
export function useMobileEditing() { return useSyncExternalStore(subscribe, editing, () => false); }
