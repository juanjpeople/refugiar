import { db } from "@/lib/db";
import type { Actor } from "@/lib/auth/permissions";
import { createId } from "@/lib/id";
import { ValidationError } from "@/lib/errors";
import { newPhotoKey } from "@/lib/sync/photos";
import { getSyncLink } from "@/lib/sync/middleware";
import { writableProject } from "./workspace-service";
export async function attachDocument(
  actor: Actor | null,
  projectId: string,
  file: File,
) {
  if (file.size > 3 * 1024 * 1024 || file.size === 0)
    throw new ValidationError("projects.fileLimit");
  await db.transaction("rw", db.projects, db.photos, async () => {
    await writableProject(actor, projectId);
    if (
      (await db.photos
        .where("[ownerType+ownerId]")
        .equals(["project", projectId])
        .count()) >= 12
    )
      throw new ValidationError("projects.fileLimit");
    await db.photos.add({
      id: createId(),
      ownerType: "project",
      ownerId: projectId,
      fileName: file.name.slice(0, 200),
      blob: new Blob([file], { type: "application/octet-stream" }),
      thumb: new Blob([new Uint8Array([0])]),
      mime: "application/octet-stream",
      width: 0,
      height: 0,
      createdBy: actor!.id,
      createdAt: Date.now(),
      ...(getSyncLink() ? { key: newPhotoKey() } : {}),
    });
  });
}
