import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { AppEnv, Env, SessionUser } from "./env";

const DAY = 86400000;
export const shareBucket = (operation: string, owner: string) =>
  `share-${operation}:${owner}:${Math.floor(Date.now() / DAY)}`;
export const shareQuota =
  "coalesce((select count from attempts where key=?),0) < ?";
/** Immediately follows the successful mutation in the same atomic D1 batch. */
export const chargeShare = (env: Env, bucket: string) =>
  env.DB.prepare(
    "insert into attempts(key,count,window_start) select ?,1,? where changes()>0 on conflict(key) do update set count=count+1",
  ).bind(bucket, Date.now());
export async function shareCount(env: Env, bucket: string) {
  return (
    (
      await env.DB.prepare("select count from attempts where key=?")
        .bind(bucket)
        .first<{ count: number }>()
    )?.count ?? 0
  );
}
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const key = z.string().min(1).max(160);
const body = z
  .string()
  .max(160000)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
const itemIds = z
  .array(z.string().uuid())
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length);
const publish = z.object({
  id: z.string().uuid(),
  sourceKey: key,
  sources: z.array(key).min(1).max(150),
  kind: z.enum(["recipe", "project", "shopping-list", "event", "meal-plan"]),
  mode: z.enum(["snapshot", "live-read", "live-check"]),
  tokenHash: token,
  writeHash: token.optional(),
  body,
  days: z.number().int().min(1).max(90),
  itemIds,
});
interface Mark {
  id: string;
  revision: number;
  checked: boolean;
  received: boolean;
}
interface Row {
  id: string;
  owner_id: string;
  kind: string;
  mode: string;
  token_hash: string;
  write_hash: string | null;
  body: string;
  items: string;
  version: number;
  updated_at: number;
  expires_at: number;
}
export async function shareDigest(value: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
const payload = (row: Row) => ({
  body: row.body,
  mode: row.mode,
  version: row.version,
  items: JSON.parse(row.items) as Mark[],
  updatedAt: row.updated_at,
  expiresAt: row.expires_at,
});

export function contentShares(
  requireUser: (c: Context<AppEnv>) => Promise<SessionUser | null>,
  tooMany: (
    env: Env,
    key: string,
    max: number,
    window: number,
  ) => Promise<boolean>,
) {
  const app = new Hono<AppEnv>();
  app.use(
    "/shares*",
    bodyLimit({
      maxSize: 190000,
      onError: (c) => c.json({ error: "too-large" }, 413),
    }),
  );
  app.use(
    "/shared/*",
    bodyLimit({
      maxSize: 2048,
      onError: (c) => c.json({ error: "too-large" }, 413),
    }),
  );
  const limited = (c: Context<AppEnv>) =>
    c.json(
      {
        error: "quota-exceeded",
        resetAt: (Math.floor(Date.now() / DAY) + 1) * DAY,
      },
      429,
    );
  const record = (operation: string, result: string) =>
    console.info(JSON.stringify({ feature: "sharing", operation, result }));
  app.post("/shares", async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const parsed = publish.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid" }, 400);
    const x = parsed.data,
      now = Date.now();
    if (
      !x.sources.includes(x.sourceKey) ||
      (x.mode !== "snapshot" && x.kind !== "shopping-list") ||
      x.writeHash === x.tokenHash ||
      (x.mode === "live-check") !== !!x.writeHash ||
      (x.kind !== "shopping-list" && x.itemIds.length)
    )
      return c.json({ error: "invalid" }, 400);
    const exists = await c.env.DB.prepare(
      "select id from content_shares where id=? and owner_id=? and body=? and expires_at>?",
    )
      .bind(x.id, user.id, x.body, now)
      .first();
    if (exists) return c.json({ id: x.id }, 200);
    const bucket = shareBucket("publish", user.id);
    await c.env.DB.batch([
      c.env.DB.prepare(
        "delete from content_shares where owner_id=? and expires_at<=?",
      ).bind(user.id, now),
      c.env.DB.prepare(
        "delete from project_shares where owner_id=? and expires_at<=?",
      ).bind(user.id, now),
    ]);
    const items: Mark[] = x.itemIds.map((id) => ({
      id,
      revision: 0,
      checked: false,
      received: false,
    }));
    const results = await c.env.DB.batch([
      c.env.DB.prepare(
        `insert into content_shares(id,owner_id,source_key,kind,mode,token_hash,write_hash,body,items,created_at,updated_at,expires_at)
        select ?,?,?,?,?,?,?,?,?,?,?,? where
        (select count(*) from content_shares where owner_id=?) + (select count(*) from project_shares where owner_id=?) < 20
        and (?='snapshot' or (select count(*) from content_shares where owner_id=? and mode!='snapshot') < 5)
        and not exists(select 1 from content_share_blocks where owner_id=? and source_key in (select value from json_each(?)))
        and not exists(select 1 from project_share_blocks where owner_id=? and ('project:'||project_id) in (select value from json_each(?))) and ${shareQuota}`,
      ).bind(
        x.id,
        user.id,
        x.sourceKey,
        x.kind,
        x.mode,
        x.tokenHash,
        x.writeHash ?? null,
        x.body,
        JSON.stringify(items),
        now,
        now,
        now + x.days * DAY,
        user.id,
        user.id,
        x.mode,
        user.id,
        user.id,
        JSON.stringify(x.sources),
        user.id,
        JSON.stringify(x.sources),
        bucket,
        30,
      ),
      chargeShare(c.env, bucket),
      c.env.DB.prepare(
        "insert into content_share_sources(share_id,owner_id,source_key) select ?,?,value from json_each(?) where exists(select 1 from content_shares where id=? and owner_id=?)",
      ).bind(
        x.id,
        user.id,
        JSON.stringify([...new Set(x.sources)]),
        x.id,
        user.id,
      ),
    ]);
    if (!results[0].meta.changes) {
      record("publish", "rejected");
      return (await shareCount(c.env, bucket)) >= 30
        ? limited(c)
        : c.json({ error: "quota-or-source-closed" }, 409);
    }
    record("publish", "ok");
    return c.json({ id: x.id }, 201);
  });
  app.get("/shares", async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const now = Date.now();
    const rows = await c.env.DB.prepare(
      `select id,source_key as sourceKey,kind,mode,created_at as createdAt,expires_at as expiresAt,0 as legacy from content_shares where owner_id=? and expires_at>?
      union all select id,'project:'||project_id,'project','snapshot',created_at,expires_at,1 from project_shares where owner_id=? and expires_at>? order by createdAt desc`,
    )
      .bind(user.id, now, user.id, now)
      .all();
    const usage = await c.env.DB.prepare(
      "select key,count from attempts where key in (?,?)",
    )
      .bind(shareBucket("publish", user.id), shareBucket("changes", user.id))
      .all<{ key: string; count: number }>();
    return c.json({
      links: rows.results,
      published:
        usage.results.find((r) => r.key === shareBucket("publish", user.id))
          ?.count ?? 0,
      changes:
        usage.results.find((r) => r.key === shareBucket("changes", user.id))
          ?.count ?? 0,
      resetAt: (Math.floor(now / DAY) + 1) * DAY,
    });
  });
  app.delete("/shares/source/:source", async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const source = c.req.param("source");
    if (!key.safeParse(source).success)
      return c.json({ error: "invalid" }, 400);
    if (await tooMany(c.env, shareBucket("close", user.id), 60, DAY))
      return limited(c);
    await c.env.DB.batch([
      c.env.DB.prepare(
        "insert or ignore into content_share_blocks(owner_id,source_key) values (?,?)",
      ).bind(user.id, source),
      c.env.DB.prepare(
        "delete from content_shares where owner_id=? and id in(select share_id from content_share_sources where owner_id=? and source_key=?)",
      ).bind(user.id, user.id, source),
      ...(source.startsWith("project:")
        ? [
            c.env.DB.prepare(
              "insert or ignore into project_share_blocks(owner_id,project_id) values (?,?)",
            ).bind(user.id, source.slice(8)),
            c.env.DB.prepare(
              "delete from project_shares where owner_id=? and project_id=?",
            ).bind(user.id, source.slice(8)),
          ]
        : []),
    ]);
    return c.json({ ok: true });
  });
  app.delete("/shares/:id", async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    await c.env.DB.batch([
      c.env.DB.prepare(
        "delete from content_shares where id=? and owner_id=?",
      ).bind(c.req.param("id"), user.id),
      c.env.DB.prepare(
        "delete from project_shares where id=? and owner_id=?",
      ).bind(c.req.param("id"), user.id),
    ]);
    return c.json({ ok: true });
  });
  app.get("/shares/:id", async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const row = await c.env.DB.prepare(
      "select * from content_shares where id=? and owner_id=? and expires_at>?",
    )
      .bind(c.req.param("id"), user.id, Date.now())
      .first<Row>();
    return row ? c.json(payload(row)) : c.json({ error: "not-found" }, 404);
  });
  app.patch("/shares/:id", async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const parsed = z
      .object({
        body,
        version: z.number().int().nonnegative(),
        itemIds,
        receivedIds: itemIds,
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid" }, 400);
    const row = await c.env.DB.prepare(
      "select * from content_shares where id=? and owner_id=? and expires_at>?",
    )
      .bind(c.req.param("id"), user.id, Date.now())
      .first<Row>();
    if (!row) return c.json({ error: "not-found" }, 404);
    if (row.mode === "snapshot") return c.json({ error: "forbidden" }, 403);
    const x = parsed.data;
    if (row.version !== x.version) return c.json({ error: "conflict" }, 409);
    if (x.receivedIds.some((id) => !x.itemIds.includes(id)))
      return c.json({ error: "invalid" }, 400);
    const bucket = shareBucket("changes", user.id);
    const before = new Map(
      (JSON.parse(row.items) as Mark[]).map((item) => [item.id, item]),
    );
    const items = x.itemIds.map((id) => {
      const previous = before.get(id) ?? {
        id,
        revision: 0,
        checked: false,
        received: false,
      };
      return x.receivedIds.includes(id) && !previous.received
        ? {
            ...previous,
            revision: previous.revision + 1,
            checked: true,
            received: true,
          }
        : previous;
    });
    const [changed] = await c.env.DB.batch([
      c.env.DB.prepare(
        `update content_shares set body=?,items=?,version=version+1,updated_at=? where id=? and owner_id=? and version=? and expires_at>? and ${shareQuota}`,
      ).bind(
        x.body,
        JSON.stringify(items),
        Date.now(),
        row.id,
        user.id,
        x.version,
        Date.now(),
        bucket,
        300,
      ),
      chargeShare(c.env, bucket),
    ]);
    if (!changed.meta.changes) {
      record("update", "rejected");
      return (await shareCount(c.env, bucket)) >= 300
        ? limited(c)
        : c.json({ error: "conflict" }, 409);
    }
    record("update", "ok");
    return c.json({ ok: true });
  });
  async function publicRow(c: Context<AppEnv>, raw: unknown) {
    const parsed = z.object({ token }).safeParse(raw);
    if (
      !parsed.success ||
      !z.string().uuid().safeParse(c.req.param("id")).success
    )
      return null;
    return c.env.DB.prepare(
      "select * from content_shares where id=? and token_hash=? and expires_at>?",
    )
      .bind(c.req.param("id"), await shareDigest(parsed.data.token), Date.now())
      .first<Row>();
  }
  app.post("/shared/:id", async (c) => {
    if (
      await tooMany(
        c.env,
        `share-read:${c.req.header("CF-Connecting-IP") ?? "unknown"}`,
        60,
        60000,
      )
    )
      return c.json({ error: "rate-limited" }, 429);
    const row = await publicRow(c, await c.req.json().catch(() => null));
    return row ? c.json(payload(row)) : c.json({ error: "not-found" }, 404);
  });
  app.post("/shared/:id/check", async (c) => {
    if (
      await tooMany(
        c.env,
        `share-read:${c.req.header("CF-Connecting-IP") ?? "unknown"}`,
        60,
        60000,
      )
    )
      return c.json({ error: "rate-limited" }, 429);
    const parsed = z
      .object({
        token,
        writeToken: token,
        itemId: z.string().uuid(),
        revision: z.number().int().nonnegative(),
        checked: z.boolean(),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid" }, 400);
    const x = parsed.data;
    let row = await publicRow(c, x);
    if (!row) return c.json({ error: "not-found" }, 404);
    if (
      row.mode !== "live-check" ||
      row.write_hash !== (await shareDigest(x.writeToken))
    )
      return c.json({ error: "forbidden" }, 403);
    const bucket = shareBucket("changes", row.owner_id);
    // A row CAS protects different products too. Retry unrelated changes without hiding a product conflict.
    for (let attempt = 0; attempt < 5 && row; attempt++) {
      const items = JSON.parse(row.items) as Mark[];
      const target = items.find((item) => item.id === x.itemId);
      if (!target || target.received || target.revision !== x.revision)
        return c.json({ error: "conflict" }, 409);
      target.checked = x.checked;
      target.revision++;
      const [saved] = await c.env.DB.batch([
        c.env.DB.prepare(
          `update content_shares set items=?,version=version+1 where id=? and version=? and expires_at>? and ${shareQuota}`,
        ).bind(
          JSON.stringify(items),
          row.id,
          row.version,
          Date.now(),
          bucket,
          300,
        ),
        chargeShare(c.env, bucket),
      ]);
      if (saved.meta.changes) {
        record("check", "ok");
        return c.json({ ok: true });
      }
      if ((await shareCount(c.env, bucket)) >= 300) {
        record("check", "quota");
        return limited(c);
      }
      row = await publicRow(c, x);
    }
    return c.json({ error: "conflict" }, 409);
  });
  return app;
}
