/**
 * Servicio de proyectos: ÚNICO punto que los escribe. Borrar un proyecto no borra sus listas:
 * quedan sueltas (con sus gastos), porque lo comprado sigue siendo un dato de la casa.
 */
import { deletePhotosOfWithin } from "@/features/media/service";
import { writableProject } from "./workspace-service";
import { recordActivity, setActivityPrivacy } from "@/features/activity/service";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { useDeviceStore } from "@/store/useDeviceStore";
import { closeProjectShares } from "./sharing";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { parseProjectInput, type ProjectInput, type ProjectStatus } from "./domain";

export async function createProject(actor: Actor | null, input: ProjectInput) {
  assertCan(actor, "projects.manage");
  const data = parseProjectInput(input);
  const id = createId();
  const now = Date.now();
  await db.transaction("rw", db.projects, db.activity, async () => {
    await db.projects.add({ ...data, id, status: "active", createdBy: actor.id, createdAt: now, updatedAt: now });
    await recordActivity(actor, { module: "projects", action: "create", entityId: id, entityName: data.name, privacy: data.privacy, createdBy: actor.id });
  });
  return id;
}

export async function updateProject(actor: Actor | null, id: string, input: ProjectInput) {
  assertCan(actor, "projects.manage");
  const data = parseProjectInput(input);
  await writableProject(actor,id);
  await db.transaction("rw", db.projects, db.activity, async () => {
    const project = await db.projects.get(id);
    if (!project) throw new NotFoundError("errors.notFound.project");
    if(data.currency!==project.currency && ((project.workspace?.expenses?.length??0)>0 || project.workspace?.materials?.some(row=>row.costCents!==undefined))) throw new ValidationError("projects.currencyLocked");
    await setActivityPrivacy("projects", id, data.privacy, project.createdBy);
    await db.projects.update(id, { ...data, updatedAt: Date.now() });
    await recordActivity(actor, { module: "projects", action: "update", entityId: id, entityName: data.name, privacy: data.privacy, createdBy: project.createdBy });
  });
}

export async function setProjectStatus(actor: Actor | null, id: string, status: ProjectStatus) {
  assertCan(actor, "projects.manage");
  await writableProject(actor, id);
  await db.projects.update(id, { status, updatedAt: Date.now() });
}

export async function deleteProject(actor: Actor | null, id: string) {
  assertCan(actor, "projects.manage");
  const before = await writableProject(actor,id);
  if(before.externalShares){
    if(useDeviceStore.getState().mode!=="cloud" || before.createdBy!==actor!.id) throw new ValidationError("projects.deleteShares");
    await closeProjectShares(id);
  }
  await db.transaction("rw", db.projects, db.shoppingLists, db.activity, db.photos, db.photoDeletes, async () => {
    const project = await db.projects.get(id);
    if (!project) return;
    await setActivityPrivacy("projects", id, project.privacy ?? "family", project.createdBy);
    await db.shoppingLists.where("projectId").equals(id).modify((list) => {
      delete list.projectId;
    });
    await deletePhotosOfWithin("project", id);
    await db.projects.delete(id);
    await recordActivity(actor, { module: "projects", action: "delete", entityId: id, entityName: project.name, privacy: project.privacy ?? "family", createdBy: project.createdBy });
  });
}
