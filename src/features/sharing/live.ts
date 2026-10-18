import { db } from "@/lib/db";
import { api, CloudError } from "@/lib/cloud/api";
import { inviteSecrets, seal } from "@/lib/crypto";
import type { Actor } from "@/lib/auth/permissions";
import { buildShare } from "./sources";
import type { LocalPublication, ShareRead } from "./domain";

export async function refreshPublication(
  actor: Actor,
  local: LocalPublication,
) {
  if (local.mode === "snapshot") return;
  try {
    const remote = await api<ShareRead>("GET", `/shares/${local.id}`);
    const built = await buildShare(
      actor,
      local.source,
      local.selection,
      local.itemMap,
    );
    if (built.content.kind !== "shopping-list") return;
    if (built.content.items.length > 100)
      throw new CloudError("too-large", 413);
    const byId = new Map(remote.items.map((mark) => [mark.id, mark]));
    const checks: Record<string, boolean> = {};
    await db.transaction("r", db.shoppingList, async () => {
      for (const [id, entry] of Object.entries(local.itemMap)) {
        const row = await db.shoppingList.get(id);
        if (!row || row.listId !== local.source.id) continue;
        const mark = byId.get(entry.id);
        // Never write status or stock from an external report.
        checks[id] =
          built.itemMap[id]?.id === entry.id &&
          row.status === "pending" &&
          !!mark?.checked &&
          !mark.received;
      }
    });
    await db.publications.update(local.id, { checks, lastError: undefined });
    // publishedAt changes only when the selected content changes.
    const previous = JSON.parse(local.lastBody) as { publishedAt: number };
    built.content.publishedAt = previous.publishedAt;
    const serialized = JSON.stringify(built.content);
    const receivedIds = built.content.items
      .filter((item) => item.bought)
      .map((item) => item.id);
    const needsReceipt = receivedIds.some((id) => !byId.get(id)?.received);
    if (serialized === local.lastBody && !needsReceipt) return;
    built.content.publishedAt = Date.now();
    const lastBody = JSON.stringify(built.content);
    const secrets = await inviteSecrets(local.secret);
    const body = await seal(
      secrets.wrapKey,
      lastBody,
      `content-share/v1/${local.id}`,
    );
    if (body.length > 160000) throw new CloudError("too-large", 413);
    await api("PATCH", `/shares/${local.id}`, {
      body,
      version: remote.version,
      itemIds: built.content.items.map((item) => item.id),
      receivedIds,
    });
    await db.publications.update(local.id, {
      itemMap: built.itemMap,
      lastBody,
      lastError: undefined,
    });
  } catch (error) {
    if (error instanceof CloudError && error.status === 404)
      await db.publications.delete(local.id);
    else
      await db.publications.update(local.id, {
        lastError:
          error instanceof CloudError ? error.code : "source-unavailable",
      });
  }
}
