"use client";

import { Dog } from "lucide-react";
import { useMemo } from "react";
import type { FeatureSearch, SearchContext } from "@/lib/navigation/commands";
import { petProfileId } from "./domain";
import { usePets } from "./hooks";

/** Mascotas por nombre. */
export function usePetSearch({ router, visible }: SearchContext): FeatureSearch {
  const pets = usePets();

  return useMemo(() => {
    const byId = new Map((pets ?? []).map((pet) => [pet.id, pet]));
    return {
      entries: visible.has("calendar")
        ? (pets ?? []).map((pet) => ({
            id: `pet:${pet.id}`,
            group: "actions" as const,
            label: pet.name,
            icon: Dog,
            run: () => router.push(`/mascotas?id=${pet.id}`),
          }))
        : [],
      recent: (routeId, id) => {
        const pet = routeId === "pets" ? byId.get(petProfileId(id)) : undefined;
        return pet && { label: pet.name, icon: Dog };
      },
    };
  }, [pets, visible, router]);
}
