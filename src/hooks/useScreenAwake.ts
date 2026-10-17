"use client";

import { registerPlugin } from "@capacitor/core";
import { isAndroidApp } from "@/lib/platform";
import { useEffect, useState } from "react";

const kitchenScreen = registerPlugin<{ setEnabled(options: { enabled: boolean }): Promise<void> }>("KitchenScreen");

/** Se libera al salir, y se vuelve a pedir al regresar del fondo. */
export function useScreenAwake(enabled: boolean) {
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    if (isAndroidApp()) {
      void kitchenScreen.setEnabled({ enabled: true }).then(() => { if (!stopped) setUnavailable(false); }).catch(() => { if (!stopped) setUnavailable(true); });
      return () => { stopped = true; void kitchenScreen.setEnabled({ enabled: false }).catch(() => undefined); };
    }
    let lock: WakeLockSentinel | undefined;
    let requesting = false;
    const acquire = async () => {
      if (stopped || requesting || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      requesting = true;
      try {
        if (!navigator.wakeLock) throw new Error("unavailable");
        const next = await navigator.wakeLock.request("screen");
        if (stopped) { await next.release(); return; }
        lock = next;
        setUnavailable(false);
      } catch { if (!stopped) setUnavailable(true); }
      finally { requesting = false; }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => { stopped = true; document.removeEventListener("visibilitychange", acquire); void lock?.release().catch(() => undefined); };
  }, [enabled]);
  return enabled && unavailable;
}
