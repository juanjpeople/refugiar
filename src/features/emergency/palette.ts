"use client";

import { Radio, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import { useT } from "@/i18n";
import type { FeatureSearch, SearchContext } from "@/lib/navigation/commands";
import { GUIDES } from "./components/Panes";

/** Guías rápidas y frecuencias de radio de Emergencias en la búsqueda global (Ctrl+K). */
export function useEmergencySearch({ router }: SearchContext): FeatureSearch {
  const t = useT();

  return useMemo(
    () => ({
      entries: [
        ...GUIDES.map((guide) => ({
          id: `emergency:guide:${guide}`,
          group: "actions" as const,
          label: `${t("nav.routes.emergency")}: ${t(`emergency.guides.${guide}.title`)}`,
          icon: ShieldAlert,
          run: () => router.push("/emergencias#guias"),
        })),
        {
          id: "emergency:radio",
          group: "actions" as const,
          label: `${t("nav.routes.emergency")}: ${t("emergency.sections.radio")}`,
          icon: Radio,
          run: () => router.push("/emergencias#radio"),
        },
      ],
    }),
    [router, t],
  );
}
