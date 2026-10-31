import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Env } from "../src/env";
import { DAY } from "../src/inactivity";
import { mailConfigState, mailOverview, processEmails, queueTestEmail, renderEmailHtml, reserveEmailBudget, securityEmailStatements, sendOperatorRecoveryEmail } from "../src/mail";

const now = Date.UTC(2026, 9, 11, 12);
function fixture(t: { after(fn: () => void): void }) {
  const database = new DatabaseSync(":memory:");
  t.after(() => database.close());
  database.exec(`
    create table "user" (id text primary key, email text);
    create table households (id text primary key, created_at integer, last_activity_at integer);
    create table household_plans (household_id text, status text);
    create table memberships (household_id text, user_id text);
    create table inactivity_notices (household_id text, days_before_pause integer, due_at integer, status text, updated_at integer);
    insert into "user" values ('owner', 'owner@example.test'), ('other', 'other@example.test');
  `);
  database.exec(readFileSync("server/migrations/0012_email_outbox.sql", "utf8"));
  function prepare(sql: string, args: (string | number | null)[] = []) {
    return {
      bind: (...values: (string | number | null)[]) => prepare(sql, values),
      first: async () => database.prepare(sql).get(...args) ?? null,
      all: async () => ({ results: database.prepare(sql).all(...args) }),
      run: async () => ({ success: true, meta: { changes: database.prepare(sql).run(...args).changes } }),
    };
  }
  const env = {
    EMAIL_ENABLED: "1", EMAIL_FROM: "avisos@example.test", RESEND_API_KEY: "re_synthetic_test",
    OPERATOR_EMAIL: "operator@example.test", APP_ORIGIN: "https://app.example.test",
    DB: { prepare, batch: async (statements: { run(): Promise<unknown> }[]) => {
      database.exec("begin");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        database.exec("commit");
        return results;
      } catch (error) { database.exec("rollback"); throw error; }
    } },
  } as unknown as Env;
  return { database, env };
}

test("mail: explicit opt-in and complete configuration; no external calls when disabled", async t => {
  const { env, database } = fixture(t);
  env.EMAIL_ENABLED = "0";
  assert.equal(mailConfigState(env), "disabled");
  assert.deepEqual(securityEmailStatements(env, { id: "owner", email: "owner@example.test" }, "password"), []);
  const result = await processEmails(env, now, async () => { throw new Error("Unexpected external call"); });
  assert.equal(result.config, "disabled");
  assert.equal(database.prepare("select count(*) as count from email_outbox").get()?.count, 0);
  env.EMAIL_ENABLED = "1";
  env.EMAIL_FROM = "invalid\nsender";
  assert.equal(mailConfigState(env), "incomplete");
  assert.throws(() => securityEmailStatements(env, { id: "owner", email: "owner@example.test" }, "kit"));
});

test("mail: atomic UTC budgets stop at exactly 100 daily and 3000 monthly", async t => {
  const { env, database } = fixture(t);
  const results = await Promise.all(Array.from({ length: 101 }, () => reserveEmailBudget(env, now)));
  assert.equal(results.filter(Boolean).length, 100);
  assert.equal((await mailOverview(env, now)).usage?.daily, 100);
  database.prepare("insert into email_usage values (?, ?)").run("2026-10-01", 2900);
  assert.equal(await reserveEmailBudget(env, now + DAY), false);
  assert.equal((await mailOverview(env, now)).usage?.monthly, 3000);
  assert.equal(await reserveEmailBudget(env, Date.UTC(2026, 10, 1)), true);
  assert.equal(await reserveEmailBudget(env, Date.UTC(2026, 10, 1, 23, 59, 59)), true);
  assert.equal(await reserveEmailBudget(env, Date.UTC(2026, 10, 2)), true);
});

test("mail: sender and operator addresses reject oversized and malformed inputs", async t => {
  const { env } = fixture(t);
  const longest = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  assert.equal(longest.length, 254);
  env.EMAIL_FROM = longest;
  assert.equal(mailConfigState(env), "configured");
  for (const invalid of [longest + "d", "!@!." + "!.".repeat(50_000), "avisos@example.test\nBcc:other@example.test", "owner@@example.test"]) {
    env.EMAIL_FROM = invalid;
    assert.equal(mailConfigState(env), "incomplete");
    env.OPERATOR_EMAIL = invalid;
    await assert.rejects(queueTestEmail(env), /Operator email is not configured/);
  }
});

test("mail: security event and account change commit together; test goes only to the operator", async t => {
  const { env, database } = fixture(t);
  const user = { id: "owner", email: "owner@example.test" };
  await assert.rejects(env.DB.batch([
    ...securityEmailStatements(env, user, "password"),
    env.DB.prepare("insert into missing_table values (1)"),
  ]));
  assert.equal(database.prepare("select count(*) as count from email_outbox").get()?.count, 0);
  await env.DB.batch(securityEmailStatements(env, user, "password"));
  await queueTestEmail(env);
  const calls: { headers: Headers; body: Record<string, unknown> }[] = [];
  const result = await processEmails(env, Date.now() + 1000, async (_url, init) => {
    calls.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return Response.json({ id: crypto.randomUUID() });
  });
  assert.equal(result.accepted, 2);
  assert.equal(calls[0].headers.get("authorization"), `Bearer ${env.RESEND_API_KEY}`);
  assert.deepEqual(calls.map(call => call.body.to), [[user.email], [env.OPERATOR_EMAIL]]);
  assert.match(String(calls[0].body.text), /Se cambió la contraseña/);
  assert(!JSON.stringify(calls.map(call => call.body)).includes(env.RESEND_API_KEY!));
  assert.equal((await processEmails(env, Date.now() + 2000, async () => { throw new Error("Duplicate send"); })).accepted, 0);
});

test("mail: retries retain body and idempotency key; unknown deliveries stop before 24 hours", async t => {
  const { env, database } = fixture(t);
  t.mock.method(console, "error", () => {});
  await queueTestEmail(env);
  const started = Date.now() + 1000;
  const requests: { body: unknown; key: string | null }[] = [];
  const send: typeof fetch = async (_url, init) => {
    requests.push({ body: init?.body, key: new Headers(init?.headers).get("idempotency-key") });
    throw new TypeError("Network unavailable");
  };
  await processEmails(env, started, send);
  assert.equal(database.prepare("select status from email_outbox").get()?.status, "pending");
  await processEmails(env, started + 5 * 60_000, send);
  assert.deepEqual(requests[0], requests[1]);
  assert.equal((await mailOverview(env, started)).usage?.daily, 2);
  const firstAttempt = database.prepare("select first_attempt_at from email_outbox").get()?.first_attempt_at;
  assert.ok(typeof firstAttempt === "number");
  await processEmails(env, firstAttempt + 23 * 3_600_000, send);
  assert.equal(requests.length, 2);
  assert.equal(database.prepare("select last_error from email_outbox").get()?.last_error, "delivery-unknown");
});

test("mail: rejected and malformed responses are never recorded as sent", async t => {
  const { env, database } = fixture(t);
  t.mock.method(console, "error", () => {});
  await queueTestEmail(env);
  const started = Date.now() + 1000;
  await processEmails(env, started, async () => new Response("domain not verified", { status: 403 }));
  assert.equal(database.prepare("select status from email_outbox").get()?.status, "failed");
  assert.equal(database.prepare("select last_error from email_outbox").get()?.last_error, "http-403");
  await queueTestEmail(env);
  await processEmails(env, started + 1000, async () => Response.json({ ok: true }));
  assert.equal(database.prepare("select status from email_outbox where last_error = 'invalid-response'").get()?.status, "pending");
  assert.equal((await mailOverview(env, started)).counts.sent, undefined);
});

test("mail: notice recipients stay private; all must be accepted before marking a notice sent", async t => {
  const { env, database } = fixture(t);
  t.mock.method(console, "error", () => {});
  database.prepare("insert into households values (?, ?, ?)").run("house", now - 60 * DAY, now - 60 * DAY);
  database.exec("insert into household_plans values ('house', 'active'); insert into memberships values ('house', 'owner'), ('house', 'other')");
  database.prepare("insert into inactivity_notices values ('house', 30, ?, 'pending', ?)").run(now, now);
  const recipients: unknown[] = [];
  await processEmails(env, now, async (_url, init) => {
    recipients.push(JSON.parse(String(init?.body)).to);
    return recipients.length === 1 ? Response.json({ id: "accepted-one" }) : new Response("retry", { status: 429 });
  });
  assert.deepEqual(recipients, [["owner@example.test"], ["other@example.test"]]);
  assert.equal(database.prepare("select status from inactivity_notices").get()?.status, "pending");
  await processEmails(env, now + 5 * 60_000, async () => Response.json({ id: "accepted-two" }));
  assert.equal(database.prepare("select status from inactivity_notices").get()?.status, "sent");
  assert.equal((await mailOverview(env, now)).counts.sent, 2);
});

test("mail: resuming a house cancels queued notices instead of sending stale warnings", async t => {
  const { env, database } = fixture(t);
  t.mock.method(console, "error", () => {});
  database.prepare("insert into households values (?, ?, ?)").run("house", now - 60 * DAY, now - 60 * DAY);
  database.exec("insert into household_plans values ('house', 'active'); insert into memberships values ('house', 'owner')");
  database.prepare("insert into inactivity_notices values ('house', 30, ?, 'pending', ?)").run(now, now);
  await processEmails(env, now, async () => new Response("retry", { status: 429 }));
  database.prepare("update households set last_activity_at = ?").run(now);
  database.exec("update inactivity_notices set status = 'cancelled'");
  await processEmails(env, now + 5 * 60_000, async () => { throw new Error("Stale warning sent"); });
  assert.equal(database.prepare("select status from email_outbox").get()?.status, "cancelled");
});

test("mail: HTML template escapes unsafe markup and operator recovery email scrubs code after send", async t => {
  const { env, database } = fixture(t);
  const html = renderEmailHtml("Aviso <script>", "Hola <b>mundo</b>\n\nCódigo 123456 en https://refugi.ar/admin");
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<b>mundo</b>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<code[^>]*>123456<\/code>/);
  assert.match(html, /href="https:\/\/refugi\.ar\/admin"/);

  const state = await sendOperatorRecoveryEmail(env, "654321", now, async () => Response.json({ id: "re_rec_1" }));
  assert.equal(state, "sent");
  const row = database.prepare("select recipient, status, body from email_outbox where id like 'operator-recovery/%'").get() as { recipient: string; status: string; body: string };
  assert.equal(row.recipient, "operator@example.test");
  assert.equal(row.status, "sent");
  assert.equal(row.body, "");
});
