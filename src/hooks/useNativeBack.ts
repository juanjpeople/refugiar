"use client";

import { useEffect } from "react";
import { isAndroidApp } from "@/lib/platform";
import { useUiStore } from "@/store/useNavigationStore";

declare global { interface Window { refugiarHandleBack?: () => boolean } }

/** Android consulta primero a la interfaz; nunca abandona un diálogo que está guardando. */
export function useNativeBack() {
  useEffect(() => {
    if (!isAndroidApp()) return;
    const visible = (element: Element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
    const handle = () => {
      const popups = [...document.querySelectorAll(".ant-select-dropdown, .ant-dropdown, .ant-popover")].filter(visible);
      if (popups.length) {
        // Los menús usan el cierre por pulsación exterior de Ant Design. No activa una acción.
        document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return true;
      }
      if (useUiStore.getState().paletteOpen) {
        useUiStore.getState().setPaletteOpen(false);
        return true;
      }
      const layers = [...document.querySelectorAll<HTMLElement>(".ant-modal-wrap, .ant-drawer-open .ant-drawer-content-wrapper")].filter(visible);
      const top = layers.at(-1);
      if (top) {
        const close = top.querySelector<HTMLButtonElement>(".ant-modal-close, .ant-drawer-close, .ant-modal-confirm-btns .ant-btn-default");
        if (close && !close.disabled && !close.classList.contains("ant-btn-loading")) close.click();
        return true;
      }
      return false;
    };
    window.refugiarHandleBack = handle;
    return () => { if (window.refugiarHandleBack === handle) delete window.refugiarHandleBack; };
  }, []);
}
