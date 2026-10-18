"use client";

import { useSyncExternalStore } from "react";

function readEditing() {
  const element = document.activeElement;
  return element instanceof HTMLElement && (element.isContentEditable || element.matches("textarea, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range])"));
}

const listeners = new Set<() => void>();
let current = false;
let pointerHeld = false;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

function refresh() {
  if (pointerHeld || !listeners.size) return;
  const next = readEditing();
  if (next === current) return;
  current = next;
  listeners.forEach(change => change());
}
function focusChanged() { queueMicrotask(refresh); }
function pointerDown() {
  clearTimeout(releaseTimer);
  pointerHeld = true;
}
function pointerFinished() {
  // Keep the navigation and page padding fixed through pointerup AND its click.
  // Restoring them on input blur can cover/move the submit button between down/up.
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => { pointerHeld = false; refresh(); }, 0);
}
function windowBlurred() { pointerHeld = false; refresh(); }

function subscribe(change: () => void) {
  if (!listeners.size) {
    current = readEditing();
    document.addEventListener("focusin", focusChanged);
    document.addEventListener("focusout", focusChanged);
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("pointerup", pointerFinished, true);
    document.addEventListener("pointercancel", pointerFinished, true);
    window.addEventListener("blur", windowBlurred);
  }
  listeners.add(change);
  return () => {
    listeners.delete(change);
    if (listeners.size) return;
    document.removeEventListener("focusin", focusChanged);
    document.removeEventListener("focusout", focusChanged);
    document.removeEventListener("pointerdown", pointerDown, true);
    document.removeEventListener("pointerup", pointerFinished, true);
    document.removeEventListener("pointercancel", pointerFinished, true);
    window.removeEventListener("blur", windowBlurred);
    clearTimeout(releaseTimer);
    pointerHeld = false;
  };
}

/** Hide mobile navigation while editing, without interrupting an in-flight tap. */
export function useMobileEditing() { return useSyncExternalStore(subscribe, () => current, () => false); }
