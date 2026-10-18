import { ensurePhotoBytes } from "@/lib/sync/photos";
import { z } from "zod";
import { CURRENCIES } from "@/features/prices/domain";
import { db } from "@/lib/db";
import { useDeviceStore } from "@/store/useDeviceStore";
import { ValidationError } from "@/lib/errors";
import { api, API_URL } from "@/lib/cloud/api";
import { inviteSecrets, seal, open, sha256, toB64u } from "@/lib/crypto";
import type { Project, ProjectWorkspace } from "./domain";
export interface ProjectShare {
  id: string;
  projectId: string;
  recipient: string;
  createdAt: number;
  expiresAt: number;
}
export interface SharedProject {
  name: string;
  notes?: string;
  currency: Project["currency"];
  status: Project["status"];
  workspace: ProjectWorkspace;
  publishedAt: number;
  budgetCents?: number;
  spentCents?: number;
  pendingCents?: number;
  attachments?: { name: string; data: string }[];
}
export const listShares = () => api<ProjectShare[]>("GET", "/project-shares");
export const revokeShare = (id: string) =>
  api("DELETE", `/project-shares/${encodeURIComponent(id)}`);
export async function publishProject(
  project: Project,
  recipient: string,
  days: number,
  include: {
    costs: boolean;
    contacts: boolean;
    journal: boolean;
    files?: string[];
  },
  totals?: { spentCents: number; pendingCents: number },
) {
  if (useDeviceStore.getState().mode !== "cloud")
    throw new ValidationError("projects.shareCloud");
  // Mark before publishing: even if the network response is lost, deletion must revoke first.
  if (!(await db.projects.update(project.id, { externalShares: true })))
    throw new ValidationError("projects.shareError");
  const secrets = await inviteSecrets(),
    id = crypto.randomUUID();
  const workspace: ProjectWorkspace = {
    kind: project.workspace?.kind,
    startDate: project.workspace?.startDate,
    targetDate: project.workspace?.targetDate,
    tasks: project.workspace?.tasks?.map(({ id, text, done, due }) => ({
      id,
      text,
      done,
      due,
    })),
    materials: project.workspace?.materials?.map(
      ({ id, name, unit, quantity, used, reversedAt, costCents }) => ({
        id,
        itemId: "",
        name,
        unit,
        quantity,
        used,
        reversedAt,
        ...(include.costs ? { costCents } : {}),
      }),
    ),
  };
  if (include.costs) workspace.expenses = project.workspace?.expenses;
  if (include.contacts) workspace.contacts = project.workspace?.contacts;
  if (include.journal)
    Object.assign(workspace, {
      journal: project.workspace?.journal,
      outcome: project.workspace?.outcome,
      lessons: project.workspace?.lessons,
    });
  const snapshot: SharedProject = {
    name: project.name,
    currency: project.currency,
    status: project.status,
    workspace,
    publishedAt: Date.now(),
    ...(include.journal ? { notes: project.notes } : {}),
    ...(include.costs
      ? {
          budgetCents: project.budgetCents,
          spentCents: totals?.spentCents,
          pendingCents: totals?.pendingCents,
        }
      : {}),
  };
  const attachments: { name: string; data: string }[] = [];
  for (const fileId of include.files ?? []) {
    let file = await db.photos.get(fileId);
    if (!file || file.ownerType !== "project" || file.ownerId !== project.id)
      throw new ValidationError("projects.shareError");
    const variant = file.fileName ? "blob" : "thumb";
    if (!file[variant]) {
      await ensurePhotoBytes(file, variant);
      file = await db.photos.get(fileId);
    }
    const bytes = file?.[variant];
    if (!file || !bytes || bytes.size > 80000)
      throw new ValidationError("projects.shareFilesLimit");
    attachments.push({
      name: file.fileName ?? `foto-${file.id}.webp`,
      data: toB64u(await bytes.arrayBuffer()),
    });
  }
  snapshot.attachments = attachments;
  const body = await seal(
    secrets.wrapKey,
    JSON.stringify(snapshot),
    `project-share/v1/${id}`,
  );
  if (body.length > 160000)
    throw new ValidationError("projects.shareFilesLimit");
  await api("POST", "/project-shares", {
    id,
    projectId: project.id,
    recipient,
    days,
    tokenHash: await sha256(secrets.authToken),
    body,
  });
  return `${new URL(API_URL || window.location.origin).origin}/proyecto-compartido#${id}.${secrets.secret}`;
}
/** Explicit recipient action only; no household cookies, no persistent public cache. */
export async function readSharedProject(
  fragment: string,
): Promise<SharedProject> {
  const [id, secret] = fragment.replace(/^#/, "").split(".");
  if (!/^[0-9a-f-]{36}$/.test(id) || !secret) throw new Error("invalid");
  const secrets = await inviteSecrets(secret);
  const response = await fetch(`${API_URL}/api/shared-project/${id}`, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: secrets.authToken }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("unavailable");
  const result = (await response.json()) as { body: string };
  const data = JSON.parse(
    new TextDecoder().decode(
      await open(secrets.wrapKey, result.body, `project-share/v1/${id}`),
    ),
  );
  if (
    typeof data.name !== "string" ||
    !data.workspace ||
    !Array.isArray(data.workspace.tasks ?? []) ||
    typeof data.publishedAt !== "number"
  )
    throw new Error("invalid");
  return snapshotSchema.parse(data) as SharedProject;
}

const text = z.string().max(2000),
  identifier = z.string().max(100),
  date = z.string().max(40).optional();
const snapshotSchema = z.object({
  attachments: z
    .array(
      z.object({
        name: z.string().max(200),
        data: z
          .string()
          .max(110000)
          .regex(/^[A-Za-z0-9_-]*$/),
      }),
    )
    .max(12)
    .optional(),
  name: text,
  notes: text.optional(),
  currency: z.enum(CURRENCIES),
  status: z.enum(["active", "done"]),
  publishedAt: z.number().finite(),
  spentCents: z.number().finite().nonnegative().optional(),
  pendingCents: z.number().finite().nonnegative().optional(),
  budgetCents: z.number().int().nonnegative().optional(),
  workspace: z.object({
    kind: z
      .enum(["repair", "electronics", "restoration", "garden", "other"])
      .optional(),
    startDate: date,
    targetDate: date,
    outcome: text.optional(),
    lessons: text.optional(),
    tasks: z
      .array(z.object({ id: identifier, text, done: z.boolean(), due: date }))
      .max(100)
      .optional(),
    journal: z
      .array(
        z.object({
          id: identifier,
          text,
          at: z.number().finite(),
          author: text,
          kind: z.enum(["note", "idea", "decision"]),
        }),
      )
      .max(100)
      .optional(),
    expenses: z
      .array(
        z.object({
          id: identifier,
          label: text,
          cents: z.number().int().nonnegative(),
          date: z.string(),
        }),
      )
      .max(100)
      .optional(),
    contacts: z
      .array(
        z.object({ id: identifier, name: text, role: text, details: text }),
      )
      .max(100)
      .optional(),
    materials: z
      .array(
        z.object({
          id: identifier,
          itemId: z.string(),
          name: text,
          unit: text,
          quantity: z.number().finite().positive(),
          used: z.boolean(),
          reversedAt: z.number().optional(),
          costCents: z.number().int().nonnegative().optional(),
        }),
      )
      .max(100)
      .optional(),
  }),
});

export const closeProjectShares = (projectId: string) =>
  api("DELETE", `/project-shares/project/${encodeURIComponent(projectId)}`);
