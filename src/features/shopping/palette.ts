"use client";

import { ClipboardList, ListPlus } from "lucide-react";
import { useMemo } from "react";
import { can } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/lib/auth/session";
import type { FeatureSearch, SearchContext } from "@/lib/navigation/commands";
import { listName, useListSummaries } from "./hooks";

/** Listas activas ("baño" encuentra las listas del proyecto) y "Anotar en la lista". */
export function useShoppingSearch({ t, router, visible }: SearchContext): FeatureSearch {
  const lists = useListSummaries();
  const user = useCurrentUser();

  return useMemo(() => {
    const show = visible.has("compras");
    return {
      entries: show
        ? (lists ?? [])
            .filter((summary) => !summary.list.archivedAt)
            .map((summary) => ({
              id: `list:${summary.list.id}`,
              group: "lists" as const,
              label: summary.project ? `${listName(summary.list, t)} · ${summary.project.name}` : listName(summary.list, t),
              icon: ClipboardList,
              run: () => router.push(`/compras?lista=${summary.list.id}`),
            }))
        : [],
      actions: show && can(user, "shopping.manage")
        ? [{ id: "shopping:add", group: "actions", label: t("palette.actions.shoppingAdd"), icon: ListPlus, keywords: "compras lista anotar", run: () => router.push("/compras") }]
        : [],
    };
  }, [lists, user, visible, t, router]);
}
