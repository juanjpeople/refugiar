import { z } from "zod";
import { RECIPE_TAGS } from "@/features/recipes/domain";
import { CURRENCIES } from "@/features/prices/domain";

export const SHARE_LIMITS = {
  active: 20,
  live: 5,
  publish: 30,
  changes: 300,
  bytes: 160000,
  fileBytes: 80000,
  items: 100,
} as const;
export const shareKinds = [
  "recipe",
  "project",
  "shopping-list",
  "event",
  "meal-plan",
] as const;
export type ShareKind = (typeof shareKinds)[number];
export type ShareMode = "snapshot" | "live-read" | "live-check";
export interface ShareSelection {
  notes: boolean;
  costs: boolean;
  contacts: boolean;
  journal: boolean;
  bought: boolean;
  files: string[];
}
export const DEFAULT_SELECTION: ShareSelection = {
  notes: false,
  costs: false,
  contacts: false,
  journal: false,
  bought: false,
  files: [],
};
const text = z.string().max(2000),
  name = z.string().trim().min(1).max(80),
  qty = z.number().finite().min(0.001).max(100000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const time = Date.parse(value);
    return (
      Number.isFinite(time) &&
      new Date(time).toISOString().slice(0, 10) === value
    );
  });
const ingredient = z.object({ name, quantity: qty, unit: z.string().max(20) });
const recipe = z.object({
  name,
  servings: z.number().int().min(1).max(50),
  minutes: z.number().int().min(0).max(1440),
  ingredients: z.array(ingredient).max(40),
  steps: z.array(z.string().max(1000)).max(40),
  stepSeconds: z.array(z.number().int().min(0).max(86400)).max(40),
  tags: z.array(z.enum(RECIPE_TAGS)).max(RECIPE_TAGS.length),
});
const attachment = z.object({
  name: z.string().max(200),
  data: z
    .string()
    .max(106667)
    .regex(/^[A-Za-z0-9_-]+$/),
  image: z.boolean(),
});
const common = {
  version: z.literal(1),
  publishedAt: z.number().finite(),
  attachments: z.array(attachment).max(12),
};
export const sharedContentSchema = z.discriminatedUnion("kind", [
  z.object({ ...common, kind: z.literal("recipe"), recipe }),
  z.object({
    ...common,
    kind: z.literal("project"),
    name,
    currency: z.enum(CURRENCIES),
    notes: text.optional(),
    tasks: z.array(z.string().trim().min(1).max(500)).max(100),
    materials: z
      .array(
        ingredient.extend({
          costCents: z.number().int().nonnegative().optional(),
        }),
      )
      .max(100),
    outcome: text.optional(),
    lessons: text.optional(),
    journal: z
      .array(z.object({ text, kind: z.enum(["note", "idea", "decision"]) }))
      .max(100),
    contacts: z
      .array(z.object({ name: text, role: text, details: text }))
      .max(100),
    expenses: z
      .array(
        z.object({
          label: text,
          cents: z.number().int().nonnegative(),
          date: z.string().max(40),
        }),
      )
      .max(100),
    budgetCents: z.number().int().nonnegative().optional(),
  }),
  z.object({
    ...common,
    kind: z.literal("shopping-list"),
    name: name.max(60),
    currency: z.enum(CURRENCIES),
    items: z
      .array(
        ingredient.extend({
          id: z.string().uuid(),
          quantity: qty.max(10000),
          bought: z.boolean(),
          estimateCents: z.number().int().nonnegative().optional(),
        }),
      )
      .max(1000),
  }),
  z.object({
    ...common,
    kind: z.literal("event"),
    name,
    start: z.number().finite(),
    end: z.number().finite(),
    allDay: z.boolean(),
    startDate: date,
    endDate: date,
    timeZone: z.string().max(80),
    notes: z.string().max(1000).optional(),
  }),
  z.object({
    ...common,
    kind: z.literal("meal-plan"),
    name,
    week: date,
    recipes: z.array(recipe).max(40),
    meals: z
      .array(
        z.object({
          day: z.number().int().min(0).max(6),
          recipe: z.number().int().min(0).max(39),
          servings: z.number().int().min(1).max(50),
        }),
      )
      .max(100),
  }),
]);
export type SharedContentV1 = z.infer<typeof sharedContentSchema>;
export type SharedRecipe = z.infer<typeof recipe>;
export interface ShareMark {
  id: string;
  revision: number;
  checked: boolean;
  received: boolean;
}
export interface ShareRecord {
  id: string;
  sourceKey: string;
  kind: ShareKind;
  mode: ShareMode;
  createdAt: number;
  expiresAt: number;
  legacy?: boolean;
}
export interface ShareRead {
  body: string;
  mode: ShareMode;
  version: number;
  updatedAt: number;
  expiresAt: number;
  items: ShareMark[];
}
export interface SourceRequest {
  kind: ShareKind;
  id: string;
  start?: number;
  end?: number;
  name?: string;
}
export interface LocalPublication {
  id: string;
  ownerId: string;
  actorId: string;
  source: SourceRequest;
  selection: ShareSelection;
  mode: ShareMode;
  secret: string;
  writeToken?: string;
  itemMap: Record<
    string,
    { id: string; fingerprint: string; received?: boolean }
  >;
  expiresAt: number;
  lastBody: string;
  lastError?: string;
  checks?: Record<string, boolean>;
}
export interface ShareImport {
  id: string;
  href: string;
  createdAt: number;
}
export const sharedName = (value: SharedContentV1) =>
  value.kind === "recipe" ? value.recipe.name : value.name;
export function parseSharedContent(input: unknown): SharedContentV1 {
  const value = sharedContentSchema.parse(input);
  if (!Number.isFinite(new Date(value.publishedAt).getTime()))
    throw new Error("invalid-date");
  if (value.kind === "event") {
    if (
      !Number.isFinite(new Date(value.start).getTime()) ||
      !Number.isFinite(new Date(value.end).getTime()) ||
      value.end < value.start ||
      value.endDate < value.startDate
    )
      throw new Error("invalid-event");
    new Intl.DateTimeFormat("en", { timeZone: value.timeZone }).format(
      value.start,
    );
  }
  if (
    value.kind === "meal-plan" &&
    value.meals.some((meal) => !value.recipes[meal.recipe])
  )
    throw new Error("invalid-meal");
  if (
    value.kind === "recipe" &&
    value.recipe.stepSeconds.length !== value.recipe.steps.length
  )
    throw new Error("invalid-steps");
  if (
    value.kind === "meal-plan" &&
    value.recipes.some(
      (recipe) => recipe.steps.length !== recipe.stepSeconds.length,
    )
  )
    throw new Error("invalid-steps");
  return value;
}
export const localDate = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
