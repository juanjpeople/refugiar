import { roundQuantity } from "@/features/inventory/quantity";
import { db } from "@/lib/db";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { canSee } from "@/lib/sync/scope";
import { NotFoundError, ValidationError, PermissionError } from "@/lib/errors";
import { createId } from "@/lib/id";
import {
  consumeWithin,
  restockWithin,
  QUANTITY_TABLES,
} from "@/features/inventory/service";
import type { ProjectWorkspace, ProjectMaterial } from "./domain";

export async function writableProject(actor: Actor | null, id: string) {
  assertCan(actor, "projects.manage");
  const project = await db.projects.get(id);
  if (!project) throw new NotFoundError("errors.notFound.project");
  if (!canSee(actor, project)) throw new PermissionError("projects.manage");
  return project;
}

export async function saveWorkspace(
  actor: Actor | null,
  id: string,
  patch: Partial<ProjectWorkspace>,
) {
  await db.transaction("rw", db.projects, async () => {
    const project = await writableProject(actor, id);
    const workspace = { ...project.workspace, ...patch };
    // Limit each collection and the whole record, safely below a sync operation's limit.
    for (const field of [
      "tasks",
      "journal",
      "expenses",
      "materials",
      "contacts",
    ] as const) {
      if ((workspace[field]?.length ?? 0) > 100)
        throw new ValidationError("projects.limit");
    }
    if (new TextEncoder().encode(JSON.stringify(workspace)).length > 90_000)
      throw new ValidationError("projects.limit");
    for (const task of workspace.tasks ?? [])
      if (!task.text.trim() || task.text.length > 500)
        throw new ValidationError("errors.validation.nameRequired");
    for (const note of workspace.journal ?? [])
      if (!note.text.trim() || note.text.length > 2000)
        throw new ValidationError("projects.limit");
    for (const expense of workspace.expenses ?? [])
      if (
        !Number.isSafeInteger(expense.cents) ||
        expense.cents < 0 ||
        expense.cents > 1_000_000_000
      )
        throw new ValidationError("errors.validation.quantityInvalid");
    await db.projects.update(id, { workspace, updatedAt: Date.now() });
  });
}

export async function planMaterial(
  actor: Actor | null,
  id: string,
  itemId: string,
  quantity: number,
  costCents?: number,
) {
  if (
    !Number.isFinite(quantity) ||
    quantity < 0.001 ||
    quantity > 100_000 ||
    (costCents !== undefined &&
      (!Number.isSafeInteger(costCents) ||
        costCents < 0 ||
        costCents > 1_000_000_000))
  )
    throw new ValidationError("errors.validation.quantityInvalid");
  await db.transaction("rw", db.projects, db.inventory, async () => {
    const project = await writableProject(actor, id);
    const item = await db.inventory.get(itemId);
    if (!item) throw new NotFoundError("errors.notFound.item");
    const material: ProjectMaterial = {
      id: createId(),
      itemId,
      name: item.name,
      unit: item.unit,
      quantity: roundQuantity(quantity),
      used: false,
      costCents,
    };
    await saveWorkspace(actor, id, {
      materials: [...(project.workspace?.materials ?? []), material],
    });
  });
}

export async function consumeProjectMaterial(
  actor: Actor | null,
  id: string,
  materialId: string,
  reverse = false,
) {
  assertCan(actor, reverse ? "inventory.adjust" : "inventory.consume");
  await db.transaction("rw", [db.projects, ...QUANTITY_TABLES()], async () => {
    const project = await writableProject(actor, id);
    const materials = structuredClone(project.workspace?.materials ?? []);
    const material = materials.find((row) => row.id === materialId);
    if (!material || material.reversedAt || material.used === !reverse) return;
    const item = await db.inventory.get(material.itemId);
    if (!item) throw new NotFoundError("errors.notFound.item");
    if (item.unit !== material.unit)
      throw new ValidationError("projects.unitChanged");
    if (item.reusable)
      throw new ValidationError("errors.validation.reusableConsumption");
    if (!reverse && item.quantity < material.quantity)
      throw new ValidationError("projects.insufficient");
    if (reverse) {
      const restored = await restockWithin(actor, item.id, material.quantity);
      if (Math.abs(restored - material.quantity) > 0.000001)
        throw new ValidationError("errors.validation.quantityInvalid");
      material.reversedAt = Date.now();
    } else {
      await consumeWithin(actor, item.id, material.quantity);
      material.used = true;
      material.at = Date.now();
    }
    await saveWorkspace(actor, id, { materials });
  });
}

export async function duplicateProject(
  actor: Actor | null,
  id: string,
  name: string,
) {
  await db.transaction("rw", db.projects, async () => {
    const project = await writableProject(actor, id);
    const now = Date.now();
    await db.projects.add({
      ...project,
      id: createId(),
      externalShares: undefined,
      name: name.trim().slice(0, 60) || project.name,
      status: "active",
      createdBy: actor!.id,
      createdAt: now,
      updatedAt: now,
      workspace: {
        kind: project.workspace?.kind,
        tasks: project.workspace?.tasks?.map((task) => ({
          id: createId(),
          text: task.text,
          done: false,
        })),
        materials: project.workspace?.materials?.map((row) => ({
          ...row,
          id: createId(),
          used: false,
          at: undefined,
          reversedAt: undefined,
          costCents: undefined,
        })),
      },
    });
  });
}
