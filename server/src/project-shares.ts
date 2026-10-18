import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { AppEnv, Env, SessionUser } from "./env";
const input = z.object({
  id: z.string().uuid(),
  projectId: z.string().min(1).max(100),
  recipient: z.string().trim().min(1).max(120),
  tokenHash: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  body: z
    .string()
    .max(160000)
    .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
  days: z.number().int().min(1).max(90),
});
async function digest(value: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function projectShares(
  requireUser: (c: Context<AppEnv>) => Promise<SessionUser | null>,
  tooMany: (
    env: Env,
    key: string,
    max: number,
    windowMs: number,
  ) => Promise<boolean>,
) {
  const routes = new Hono<AppEnv>();
  routes.use(
    "/project-shares",
    bodyLimit({
      maxSize: 170000,
      onError: (c) => c.json({ error: "too-large" }, 413),
    }),
  );
  routes.post("/project-shares", async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    if (await tooMany(c.env, `project-publish:${user.id}`, 30, 86400000))
      return c.json({ error: "rate-limited" }, 429);
    const parsed = input.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid" }, 400);
    const x = parsed.data,
      now = Date.now();
    // Atomic bounded insert: concurrent tabs cannot exceed the account quota.
    await c.env.DB.prepare(
      "delete from project_shares where owner_id = ? and expires_at <= ?",
    )
      .bind(user.id, now)
      .run();
    const result = await c.env.DB.prepare(
      "insert into project_shares (id,owner_id,project_id,recipient,token_hash,body,created_at,expires_at) select ?,?,?,?,?,?,?,? where (select count(*) from project_shares where owner_id = ?) < 20 and not exists (select 1 from project_share_blocks where owner_id = ? and project_id = ?)",
    )
      .bind(
        x.id,
        user.id,
        x.projectId,
        x.recipient,
        x.tokenHash,
        x.body,
        now,
        now + x.days * 86400000,
        user.id,
        user.id,
        x.projectId,
      )
      .run();
    if (!result.meta.changes) return c.json({ error: "quota-exceeded" }, 409);
    return c.json({ id: x.id }, 201);
  });
  routes.get("/project-shares", async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const rows = await c.env.DB.prepare(
      "select id,project_id as projectId,recipient,created_at as createdAt,expires_at as expiresAt from project_shares where owner_id=? and expires_at>? order by created_at desc",
    )
      .bind(user.id, Date.now())
      .all();
    return c.json(rows.results);
  });
  routes.delete("/project-shares/project/:projectId", async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const projectId = c.req.param("projectId");
    if (
      projectId.length > 100 ||
      (await tooMany(c.env, `project-close:${user.id}`, 60, 86400000))
    )
      return c.json({ error: "rate-limited" }, 429);
    await c.env.DB.batch([
      c.env.DB.prepare(
        "insert or ignore into project_share_blocks(owner_id,project_id) values (?,?)",
      ).bind(user.id, projectId),
      c.env.DB.prepare(
        "delete from project_shares where owner_id=? and project_id=?",
      ).bind(user.id, projectId),
    ]);
    return c.json({ ok: true });
  });
  routes.delete("/project-shares/:id", async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    await c.env.DB.prepare(
      "delete from project_shares where id=? and owner_id=?",
    )
      .bind(c.req.param("id"), user.id)
      .run();
    return c.json({ ok: true });
  });
  routes.use(
    "/shared-project/*",
    bodyLimit({
      maxSize: 1024,
      onError: (c) => c.json({ error: "too-large" }, 413),
    }),
  );
  routes.post("/shared-project/:id", async (c) => {
    const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
    if (await tooMany(c.env, `project-read:${ip}`, 60, 60000))
      return c.json({ error: "rate-limited" }, 429);
    const data = await c.req.json().catch(() => null);
    if (
      !z.string().uuid().safeParse(c.req.param("id")).success ||
      typeof data?.token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(data.token)
    )
      return c.json({ error: "not-found" }, 404);
    const row = await c.env.DB.prepare(
      'select s.body,s.created_at as createdAt from project_shares s join "user" u on u.id=s.owner_id where s.id=? and s.token_hash=? and s.expires_at>?',
    )
      .bind(c.req.param("id"), await digest(data.token), Date.now())
      .first();
    return row ? c.json(row) : c.json({ error: "not-found" }, 404);
  });
  return routes;
}
