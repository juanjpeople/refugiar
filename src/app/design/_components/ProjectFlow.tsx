"use client";
import { useState } from "react";
import { ProjectNotebook, ProjectCover, MemberAvatar } from "@/components/ui";
import type { ProjectWorkspace } from "@/features/projects/domain";
import { DemoBlock } from "./DemoBlock";
export function ProjectFlow() {
  const [value, setValue] = useState<ProjectWorkspace>({
    kind: "repair",
    tasks: [
      { id: "measure", text: "Medir la conexión", done: true },
      { id: "check", text: "Comprobar pérdidas", done: false },
    ],
    journal: [
      {
        id: "note",
        text: "Guardamos la medida antes de comprar.",
        kind: "decision",
        author: "Ana",
        at: 1791164618666,
      },
    ],
    expenses: [
      {
        id: "labor",
        label: "Mano de obra de ejemplo",
        cents: 3000000,
        date: "2026-10-17",
      },
    ],
  });
  return (
    <DemoBlock
      id="project-notebook"
      title="ProjectNotebook · Proyectos"
      description="Tareas, bitácora, materiales, gastos y contactos. Planificar no consume stock. El ejemplo no guarda datos."
    >
      <ProjectCover src="/demo-projects/shower.webp" />
      <MemberAvatar
        member={{ name: "Elena (demo)", color: "volcano", portrait: "elena" }}
        size={64}
      />
      <ProjectNotebook
        value={value}
        currency="ARS"
        editable
        onChange={async (patch) => {
          setValue((old) => ({ ...old, ...patch }));
          return true;
        }}
      />
    </DemoBlock>
  );
}
