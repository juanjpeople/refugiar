"use client";

import { HardHat } from "lucide-react";
import { useMemo } from "react";
import type { FeatureSearch, SearchContext } from "@/lib/navigation/commands";
import { projectHref } from "@/lib/navigation/routes";
import { useProjects } from "./hooks";

/** Proyectos por nombre. */
export function useProjectSearch({ router, visible }: SearchContext): FeatureSearch {
  const projects = useProjects();

  return useMemo(() => {
    const byId = new Map((projects ?? []).map((summary) => [summary.project.id, summary.project]));
    return {
      entries: visible.has("projects")
        ? (projects ?? []).map((summary) => ({
            id: `project:${summary.project.id}`,
            group: "lists" as const,
            label: summary.project.name,
            icon: HardHat,
            run: () => router.push(projectHref(summary.project.id)),
          }))
        : [],
      recent: (routeId, id) => {
        const project = routeId === "project" ? byId.get(id) : undefined;
        return project && { label: project.name, icon: HardHat };
      },
    };
  }, [projects, visible, router]);
}
