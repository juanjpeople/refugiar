"use client";

import { useEffect, useState } from "react";

/** Hora actual que se refresca cada `intervalMs` (para textos como "hace 5 minutos"). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") setNow(Date.now()); };
    const id = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", refresh); };
  }, [intervalMs]);

  return now;
}
