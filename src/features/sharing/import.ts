import { db } from "@/lib/db";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { fromB64u, toB64u } from "@/lib/crypto";
import { DEMO_ENABLED } from "@/lib/demo";
import type { Privacy } from "@/lib/sync/scope";
import { createRecipe } from "@/features/recipes/service";
import { createProject } from "@/features/projects/service";
import { saveWorkspace } from "@/features/projects/workspace-service";
import { createList, addShoppingItem } from "@/features/shopping/service";
import { createEvent } from "@/features/calendar/service";
import { planMeal } from "@/features/recipes/meal-plan";
import { recipeHref, projectHref } from "@/lib/navigation/routes";
import { parseSharedContent, type SharedContentV1 } from "./domain";
import { imageMime } from "./attachments";
export async function importContent(
  actor: Actor | null,
  shareId: string,
  input: SharedContentV1,
  privacy: Privacy,
  week: string,
  another = false,
) {
  if (DEMO_ENABLED) throw new AppError("sharing.demo");
  const content = parseSharedContent(input);
  const permission =
    content.kind === "recipe"
      ? "recipes.manage"
      : content.kind === "project"
        ? "projects.manage"
        : content.kind === "shopping-list"
          ? "shopping.manage"
          : "calendar.manage";
  assertCan(actor, permission);
  if (content.kind === "meal-plan") assertCan(actor, "recipes.manage");
  const key = `${actor.id}:${shareId}`;
  const files = content.attachments.map((file) => {
    const bytes = new Uint8Array(fromB64u(file.data));
    if (bytes.byteLength > 80000) throw new AppError("sharing.tooLarge");
    const mime = file.image ? imageMime(bytes) : "application/octet-stream";
    if (!mime) throw new AppError("sharing.unavailable");
    return { file, blob: new Blob([bytes], { type: mime }), mime };
  });
  // Domain services stay authoritative. The outer transaction also includes the import receipt.
  return db.transaction("rw", db.tables, async () => {
    const previous = await db.shareImports.get(key);
    if (previous && !another) return previous.href;
    let href: string,
      photoOwner: { id: string; kind: "recipe" | "project" } | null = null;
    if (content.kind === "recipe") {
      const id = await createRecipe(actor, { ...content.recipe, privacy });
      href = recipeHref(id);
      photoOwner = { id, kind: "recipe" };
    } else if (content.kind === "project") {
      const id = await createProject(actor, {
        name: content.name,
        notes: content.notes,
        privacy,
        currency: content.currency,
        color: "blue",
        icon: "hammer",
      });
      await saveWorkspace(actor, id, {
        tasks: content.tasks.map((text) => ({
          id: crypto.randomUUID(),
          text,
          done: false,
        })),
        materials: content.materials.map(({ name, quantity, unit }) => ({
          id: crypto.randomUUID(),
          itemId: "",
          name,
          quantity,
          unit,
          used: false,
        })),
        outcome: content.outcome,
        lessons: content.lessons,
        journal: content.journal.map((note) => ({
          ...note,
          id: crypto.randomUUID(),
          author: "",
          at: Date.now(),
        })),
      });
      href = projectHref(id);
      photoOwner = { id, kind: "project" };
    } else if (content.kind === "shopping-list") {
      const id = await createList(actor, {
        name: content.name,
        privacy,
        currency: content.currency,
        color: "blue",
        icon: "cart",
      });
      for (const item of content.items)
        await addShoppingItem(actor, {
          listId: id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        });
      href = `/compras?lista=${encodeURIComponent(id)}`;
    } else if (content.kind === "event") {
      await createEvent(actor, {
        title: content.name,
        privacy,
        start: content.allDay
          ? new Date(`${content.startDate}T00:00:00`).getTime()
          : content.start,
        end: content.allDay
          ? new Date(`${content.endDate}T00:00:00`).getTime()
          : content.end,
        allDay: content.allDay,
        repeat: "none",
        participantIds: [],
        color: "blue",
        notes: content.notes,
      });
      href = "/calendario";
    } else {
      const start = new Date(`${week}T00:00:00`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(week) ||
        !Number.isFinite(start.getTime()) ||
        start.getDay() !== 1
      )
        throw new AppError("errors.validation.dateInvalid");
      const ids: string[] = [];
      for (const recipe of content.recipes)
        ids.push(await createRecipe(actor, { ...recipe, privacy }));
      for (const meal of content.meals) {
        const day = new Date(start);
        day.setDate(day.getDate() + meal.day);
        await planMeal(actor, ids[meal.recipe], day.getTime(), meal.servings);
      }
      href = "/recetas/semana";
    }
    if (photoOwner) {
      for (const { file, blob, mime } of files) {
        if (photoOwner.kind === "recipe" && !file.image) continue;
        const id = crypto.randomUUID();
        await db.photos.add({
          id,
          ownerId: photoOwner.id,
          ownerType: photoOwner.kind,
          blob,
          thumb: file.image ? blob : undefined,
          fileName: file.image ? undefined : file.name,
          mime,
          width: 0,
          height: 0,
          key: toB64u(crypto.getRandomValues(new Uint8Array(32))),
          createdBy: actor.id,
          createdAt: Date.now(),
        });
        if (photoOwner.kind === "recipe" && file.image) {
          await db.recipes.update(photoOwner.id, { coverPhotoId: id });
        }
      }
    }
    await db.shareImports.put({ id: key, href, createdAt: Date.now() });
    return href;
  });
}
