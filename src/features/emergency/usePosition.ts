"use client";

import { useCallback, useState } from "react";
import type { Position } from "./domain";

export type PositionStatus = "idle" | "locating" | "ready" | "failed";

/**
 * La posición del GPS, solo cuando la persona toca un botón (nunca al abrir la pantalla). El GPS
 * no necesita Internet. Se guarda en memoria mientras la pantalla está abierta; no se sube.
 */
export function usePosition() {
  const [position, setPosition] = useState<Position | null>(null);
  const [status, setStatus] = useState<PositionStatus>("idle");

  const locate = useCallback((): Promise<Position | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("failed");
      return Promise.resolve(null);
    }
    setStatus("locating");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (result) => {
          const next = { lat: result.coords.latitude, lng: result.coords.longitude, accuracy: Math.round(result.coords.accuracy) };
          setPosition(next);
          setStatus("ready");
          resolve(next);
        },
        () => {
          setStatus("failed");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 120_000 },
      );
    });
  }, []);

  return { position, status, locate };
}
