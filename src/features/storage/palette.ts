"use client";

import { Package, ScanLine } from "lucide-react";
import { useMemo } from "react";
import { useAllInventoryItems } from "@/features/inventory/hooks";
import type { FeatureSearch, SearchContext } from "@/lib/navigation/commands";
import { containerHref, spaceHref } from "@/lib/navigation/routes";
import { containerAppearance, spaceAppearance } from "./domain";
import { useContainers, useSpaces } from "./hooks";

/** Recintos, contenedores y productos ("leche" lleva al contenedor donde está guardada). */
export function useStorageSearch({ t, router, visible }: SearchContext): FeatureSearch {
  const spaces = useSpaces();
  const containers = useContainers();
  const items = useAllInventoryItems();

  return useMemo(() => {
    const containerById = new Map((containers ?? []).map((container) => [container.id, container]));
    const spaceById = new Map((spaces ?? []).map((space) => [space.id, space]));
    const show = visible.has("inventory");

    return {
      entries: show
        ? [
            ...(spaces ?? []).map((space) => ({
              id: `space:${space.id}`,
              group: "containers" as const,
              label: space.name,
              icon: spaceAppearance(space).Icon,
              keywords: t(`storage.spaceKinds.${space.kind}`),
              run: () => router.push(spaceHref(space.id)),
            })),
            ...(containers ?? []).map((container) => ({
              id: `container:${container.id}`,
              group: "containers" as const,
              label: `${container.path} · ${container.spaceName}`,
              icon: containerAppearance(container).Icon,
              keywords: container.code,
              run: () => router.push(containerHref(container.id)),
            })),
            ...(items ?? []).flatMap((item) => {
              const container = containerById.get(item.containerId);
              if (!container) return [];
              return [{
                id: `item:${item.id}`,
                group: "items" as const,
                label: `${item.name} · ${container.spaceName} › ${container.path}`,
                icon: Package,
                run: () => router.push(containerHref(item.containerId, { item: item.id })),
              }];
            }),
          ]
        : [],
      actions: visible.has("scan")
        ? [{ id: "scan", group: "actions", label: t("palette.actions.scan"), icon: ScanLine, keywords: "qr", run: () => router.push("/inventario/escanear") }]
        : [],
      recent: (routeId, id) => {
        const container = routeId === "container" ? containerById.get(id) : undefined;
        if (container) return { label: container.name, icon: containerAppearance(container).Icon };
        const space = routeId === "space" ? spaceById.get(id) : undefined;
        if (space) return { label: space.name, icon: spaceAppearance(space).Icon };
        return undefined;
      },
    };
  }, [spaces, containers, items, visible, t, router]);
}
