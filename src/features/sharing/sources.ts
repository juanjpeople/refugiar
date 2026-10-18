import { db } from "@/lib/db";
import { assertCan, type Actor, type Permission } from "@/lib/auth/permissions";
import { canSee } from "@/lib/sync/scope";
import { AppError } from "@/lib/errors";
import { ensurePhotoBytes } from "@/lib/sync/photos";
import { toB64u } from "@/lib/crypto";
import { expandEvents } from "@/features/calendar/domain";
import type { Recipe } from "@/features/recipes/domain";
import { HOME_LIST_ID } from "@/features/shopping/domain";
import {
  localDate,
  parseSharedContent,
  type SharedRecipe,
  type SharedContentV1,
  type ShareKind,
  type SourceRequest,
  type ShareSelection,
  type LocalPublication,
} from "./domain";

export const sharePermission: Record<ShareKind, Permission> = {
  recipe: "recipes.manage",
  project: "projects.manage",
  "shopping-list": "shopping.manage",
  event: "calendar.manage",
  "meal-plan": "calendar.manage",
};
export function assertShare(actor: Actor | null, kind: ShareKind) {
  assertCan(actor, sharePermission[kind]);
  if (kind === "meal-plan") assertCan(actor, "recipes.manage");
}
export function sourceTable(kind: string) {
  return kind === "recipe"
    ? db.recipes
    : kind === "project"
      ? db.projects
      : kind === "shopping-list"
        ? db.shoppingLists
        : kind === "event"
          ? db.events
          : null;
}
const safeRecipe = (r: Recipe): SharedRecipe => ({
  name: r.name,
  servings: r.servings,
  minutes: r.minutes,
  ingredients: r.ingredients.map(({ name, quantity, unit }) => ({
    name,
    quantity,
    unit,
  })),
  steps: [...r.steps],
  stepSeconds: r.steps.map((_, i) => r.stepSeconds?.[i] ?? 0),
  tags: [...r.tags],
});
export async function buildShare(
  actor: Actor | null,
  source: SourceRequest,
  selection: ShareSelection,
  previousMap: LocalPublication["itemMap"] = {},
) {
  assertShare(actor, source.kind);
  const common = {
    version: 1 as const,
    publishedAt: Date.now(),
    attachments: [] as SharedContentV1["attachments"],
  };
  const sources = [`${source.kind}:${source.id}`];
  const itemMap: LocalPublication["itemMap"] = {};
  let content: SharedContentV1;
  const table = sourceTable(source.kind);
  const record = table ? await table.get(source.id) : null;
  if (table && (!record || !canSee(actor, record)))
    throw new AppError("sharing.sourceMissing");
  if (source.kind === "recipe") {
    const r = await db.recipes.get(source.id);
    content = { ...common, kind: "recipe", recipe: safeRecipe(r!) };
  } else if (source.kind === "project") {
    const p = (await db.projects.get(source.id))!;
    if (p.createdBy !== actor!.id) throw new AppError("sharing.sourceMissing");
    const w = p.workspace;
    content = {
      ...common,
      kind: "project",
      name: p.name,
      currency: p.currency,
      notes: selection.notes ? p.notes : undefined,
      tasks: w?.tasks?.map((task) => task.text) ?? [],
      materials:
        w?.materials?.map(({ name, quantity, unit, costCents }) => ({
          name,
          quantity,
          unit,
          ...(selection.costs ? { costCents } : {}),
        })) ?? [],
      journal: selection.journal
        ? (w?.journal?.map(({ text, kind }) => ({ text, kind })) ?? [])
        : [],
      outcome: selection.journal ? w?.outcome : undefined,
      lessons: selection.journal ? w?.lessons : undefined,
      contacts: selection.contacts
        ? (w?.contacts?.map(({ name, role, details }) => ({
            name,
            role,
            details,
          })) ?? [])
        : [],
      expenses: selection.costs
        ? (w?.expenses?.map(({ label, cents, date }) => ({
            label,
            cents,
            date,
          })) ?? [])
        : [],
      budgetCents: selection.costs ? p.budgetCents : undefined,
    };
  } else if (source.kind === "shopping-list") {
    const list = (await db.shoppingLists.get(source.id))!;
    const entries = (
      await db.shoppingList.where("listId").equals(list.id).toArray()
    ).filter(
      (entry) =>
        selection.bought || entry.status === "pending" || previousMap[entry.id],
    );
    content = {
      ...common,
      kind: "shopping-list",
      name: list.id === HOME_LIST_ID ? (source.name ?? list.name) : list.name,
      currency: list.currency,
      items: entries.map((entry) => {
        const fingerprint = JSON.stringify([
          entry.name,
          entry.quantity,
          entry.unit,
        ]);
        const existing = previousMap[entry.id];
        const id =
          existing?.fingerprint === fingerprint &&
          !(existing.received && entry.status === "pending")
            ? existing.id
            : crypto.randomUUID();
        itemMap[entry.id] = {
          id,
          fingerprint,
          received: entry.status === "bought",
        };
        return {
          id,
          name: entry.name,
          quantity: entry.quantity,
          unit: entry.unit,
          bought: entry.status === "bought",
          ...(selection.costs ? { estimateCents: entry.estimateCents } : {}),
        };
      }),
    };
  } else if (source.kind === "event") {
    const event = (await db.events.get(source.id))!;
    const start = source.start ?? event.start,
      end = source.end ?? event.end;
    content = {
      ...common,
      kind: "event",
      name: event.title,
      start,
      end,
      allDay: event.allDay,
      startDate: localDate(start),
      endDate: localDate(end),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      notes: selection.notes ? event.notes : undefined,
    };
  } else {
    const start = new Date(`${source.id}T00:00:00`),
      end = new Date(start);
    end.setDate(end.getDate() + 7);
    if (!Number.isFinite(start.getTime())) throw new AppError("sharing.error");
    const events = (await db.events.toArray()).filter(
      (event) => event.meal && canSee(actor, event),
    );
    const occurrences = expandEvents(
      events,
      start.getTime(),
      end.getTime(),
    ).filter((entry) => entry.start >= start.getTime());
    const ids: string[] = [],
      recipes: SharedRecipe[] = [],
      meals: Extract<SharedContentV1, { kind: "meal-plan" }>["meals"] = [];
    for (const entry of occurrences) {
      const r = await db.recipes.get(entry.event!.meal!.recipeId);
      if (!r || !canSee(actor, r)) continue;
      if (!ids.includes(r.id)) {
        ids.push(r.id);
        recipes.push(safeRecipe(r));
        sources.push(`recipe:${r.id}`);
      }
      sources.push(`event:${entry.event!.id}`);
      const a = new Date(`${localDate(entry.start)}T00:00:00Z`).getTime(),
        b = new Date(`${source.id}T00:00:00Z`).getTime();
      meals.push({
        day: Math.round((a - b) / 86400000),
        recipe: ids.indexOf(r.id),
        servings: entry.event!.meal!.servings,
      });
    }
    content = {
      ...common,
      kind: "meal-plan",
      name: source.name ?? source.id,
      week: source.id,
      recipes,
      meals,
    };
  }
  for (const fileId of selection.files) {
    let file = await db.photos.get(fileId);
    if (!file || file.ownerId !== source.id || file.ownerType !== source.kind)
      throw new AppError("sharing.sourceMissing");
    const variant = file.fileName ? "blob" : "thumb";
    if (!file[variant]) {
      await ensurePhotoBytes(file, variant);
      file = await db.photos.get(fileId);
    }
    const bytes = file?.[variant];
    if (!file || !bytes || bytes.size > 80000)
      throw new AppError("sharing.tooLarge");
    content.attachments.push({
      name: file.fileName ?? `photo-${content.attachments.length + 1}.webp`,
      data: toB64u(await bytes.arrayBuffer()),
      image: !file.fileName,
    });
  }
  return {
    content: parseSharedContent(content),
    sources: [...new Set(sources)],
    itemMap,
  };
}
