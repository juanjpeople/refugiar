"use client";

import { useSetPreference } from "@/hooks/usePreferences";
import { SKINS } from "@/skins/skins";
import type { SkinId } from "@/skins/types";

/** Elegir un estilo aplica su color y su redondeo; después se pueden ajustar a mano en Ajustes. */
export function useApplySkin() {
  const setPreference = useSetPreference();
  return (value: SkinId) => {
    setPreference("skin", value);
    setPreference("brandColor", SKINS[value].brandColor);
    setPreference("borderRadius", SKINS[value].borderRadius);
  };
}
