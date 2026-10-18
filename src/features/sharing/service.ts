import { db } from "@/lib/db";
import { api, API_URL, CloudError } from "@/lib/cloud/api";
import { inviteSecrets, sha256, seal, open, toB64u } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/auth/permissions";
import { canSee } from "@/lib/sync/scope";
import { DEMO_ENABLED } from "@/lib/demo";
import { useCloudStore } from "@/features/cloud/store";
import { buildShare, sourceTable } from "./sources";
import {
  parseSharedContent,
  type SharedContentV1,
  type SourceRequest,
  type ShareSelection,
  type ShareMode,
  type ShareRead,
  type ShareRecord,
  type LocalPublication,
} from "./domain";

export interface ShareUsage {
  links: ShareRecord[];
  published: number;
  changes: number;
  resetAt: number;
}
export const listPublications = () => api<ShareUsage>("GET", "/shares");
export async function revokePublication(id: string) {
  await api("DELETE", `/shares/${encodeURIComponent(id)}`);
  await db.publications.delete(id);
}
export function shareLink(
  local: Pick<LocalPublication, "id" | "secret" | "writeToken">,
  readOnly = false,
) {
  return `${new URL(API_URL || window.location.origin).origin}/compartido#${local.id}.${local.secret}${!readOnly && local.writeToken ? `.${local.writeToken}` : ""}`;
}
export async function publishContent(
  actor: Actor | null,
  source: SourceRequest,
  selection: ShareSelection,
  mode: ShareMode,
  days: number,
  reviewed: SharedContentV1,
) {
  if (DEMO_ENABLED) throw new AppError("sharing.demo");
  const session = useCloudStore.getState().session;
  if (!session) throw new AppError("sharing.accountHint");
  if (source.kind !== "shopping-list" && mode !== "snapshot")
    throw new AppError("sharing.error");
  const built = await buildShare(actor, source, selection);
  if (
    mode !== "snapshot" &&
    built.content.kind === "shopping-list" &&
    built.content.items.length > 100
  )
    throw new AppError("sharing.liveLimit");
  const comparable = (value: SharedContentV1) =>
    JSON.stringify(value, (key, item) =>
      key === "publishedAt" || key === "id" ? undefined : item,
    );
  if (comparable(built.content) !== comparable(reviewed))
    throw new AppError("sharing.previewRequired");
  const secrets = await inviteSecrets(),
    id = crypto.randomUUID();
  const writeToken =
    mode === "live-check"
      ? toB64u(crypto.getRandomValues(new Uint8Array(32)))
      : undefined;
  const serialized = JSON.stringify(built.content);
  const body = await seal(
    secrets.wrapKey,
    serialized,
    `content-share/v1/${id}`,
  );
  if (body.length > 160000) throw new AppError("sharing.tooLarge");
  const local: LocalPublication = {
    id,
    ownerId: session.user.id,
    actorId: actor!.id,
    source,
    selection,
    mode,
    secret: secrets.secret,
    writeToken,
    itemMap: built.itemMap,
    expiresAt: Date.now() + days * 86400000,
    lastBody: serialized,
  };
  // Persist ownership before the request: a lost response must not permit unsafe source deletion.
  await db.transaction(
    "rw",
    db.publications,
    db.recipes,
    db.projects,
    db.shoppingLists,
    db.events,
    async () => {
      for (const key of built.sources) {
        const colon = key.indexOf(":"),
          table = sourceTable(key.slice(0, colon));
        if (!table) continue;
        const row = await table.get(key.slice(colon + 1));
        if (!row || !canSee(actor, row))
          throw new AppError("sharing.sourceMissing");
        await table.update(row.id, {
          externalShareOwners: [
            ...new Set([...(row.externalShareOwners ?? []), session.user.id]),
          ],
        });
      }
      await db.publications.put(local);
    },
  );
  await api("POST", "/shares", {
    id,
    sourceKey: `${source.kind}:${source.id}`,
    sources: built.sources,
    kind: source.kind,
    mode,
    tokenHash: await sha256(secrets.authToken),
    writeHash: writeToken ? await sha256(writeToken) : undefined,
    body,
    days,
    itemIds:
      built.content.kind === "shopping-list" && mode !== "snapshot"
        ? built.content.items.map((item) => item.id)
        : [],
  });
  return { local, content: built.content };
}
export function parseShareFragment(fragment: string) {
  const [id, secret, writeToken, extra] = fragment.replace(/^#/, "").split(".");
  if (
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id ?? "") ||
    !/^[A-Za-z0-9_-]{43}$/.test(secret ?? "") ||
    (writeToken !== undefined && !/^[A-Za-z0-9_-]{43}$/.test(writeToken)) ||
    extra !== undefined
  )
    throw new AppError("sharing.unavailable");
  return { id, secret, writeToken };
}
async function guestRequest<T>(
  id: string,
  suffix: string,
  data: unknown,
): Promise<T> {
  const response = await fetch(`${API_URL}/api/shared/${id}${suffix}`, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(12000),
  });
  const result = (await response.json()) as {
    error?: string;
    resetAt?: number;
  } & T;
  if (!response.ok)
    throw new CloudError(
      result.error ?? "not-found",
      response.status,
      result.resetAt,
    );
  return result;
}
export async function readContent(fragment: string) {
  const link = parseShareFragment(fragment),
    secrets = await inviteSecrets(link.secret);
  const result = await guestRequest<ShareRead>(link.id, "", {
    token: secrets.authToken,
  });
  if (typeof result.body !== "string" || result.body.length > 160000)
    throw new AppError("sharing.unavailable");
  const content = parseSharedContent(
    JSON.parse(
      new TextDecoder().decode(
        await open(secrets.wrapKey, result.body, `content-share/v1/${link.id}`),
      ),
    ),
  );
  return {
    ...result,
    content,
    id: link.id,
    canCheck: !!link.writeToken && result.mode === "live-check",
  };
}
export async function checkSharedItem(
  fragment: string,
  itemId: string,
  revision: number,
  checked: boolean,
) {
  const link = parseShareFragment(fragment),
    secrets = await inviteSecrets(link.secret);
  if (!link.writeToken) throw new AppError("sharing.unavailable");
  return guestRequest(link.id, "/check", {
    token: secrets.authToken,
    writeToken: link.writeToken,
    itemId,
    revision,
    checked,
  });
}
/** Called before deleting a source, including dependencies of a shared menu. */
export async function closeSource(kind: string, id: string) {
  const table = sourceTable(kind),
    row = table ? await table.get(id) : null;
  if (!row?.externalShareOwners?.length) return;
  const owner = useCloudStore.getState().session?.user.id;
  if (!owner || !row.externalShareOwners.includes(owner))
    throw new AppError("sharing.deleteBlocked");
  await api("DELETE", `/shares/source/${encodeURIComponent(`${kind}:${id}`)}`);
  await db.publications
    .filter((p) => p.source.kind === kind && p.source.id === id)
    .delete();
  // More than one account may have published this local source. Close each account
  // in turn instead of permanently blocking deletion after the first revocation.
  const remaining = row.externalShareOwners.filter((value) => value !== owner);
  await table!.update(id, { externalShareOwners: remaining });
  if (remaining.length) throw new AppError("sharing.deleteBlocked");
}
