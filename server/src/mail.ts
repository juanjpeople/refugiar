import { es } from "../../src/i18n/messages/es";
import { z } from "zod";
import type { Env } from "./env";
import { DAY, INACTIVITY_NOTICE_DAYS, inactivityNoticeWindow } from "./inactivity";

export const EMAIL_LIMITS = { daily: 100, monthly: 3_000, batch: 10 } as const;
const RETRY_WINDOW = 23 * 3_600_000;
const ADDRESS = z.email();
const t = (key: keyof typeof es.emails) => es.emails[key];
export type SecurityEmail = "password" | "recovery" | "kit" | "twoFactor" | "passkeys" | "sessions";
export type MailConfigState = "disabled" | "incomplete" | "configured";

function isEmailAddress(value: string | undefined): value is string {
  return typeof value === "string" && value.length <= 254 && ADDRESS.safeParse(value).success;
}

export function mailConfigState(env: Pick<Env, "EMAIL_ENABLED" | "EMAIL_FROM" | "RESEND_API_KEY">): MailConfigState {
  if (env.EMAIL_ENABLED !== "1") return "disabled";
  return isEmailAddress(env.EMAIL_FROM) && /^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY ?? "") ? "configured" : "incomplete";
}

/**
 * El celular de un chico (`device-…@device.invalid`) y una cuenta borrada (`deleted-…@deleted.invalid`)
 * no tienen buzón: escribirles solo deja rebotes, que dañan la reputación del remitente.
 */
const deliverable = (email: string) => !email.endsWith(".invalid");

function sender(env: Env) {
  if (mailConfigState(env) !== "configured") throw new Error("Email is enabled but its configuration is incomplete");
  return `Refugiar <${env.EMAIL_FROM}>`;
}

export function securityEmailStatements(env: Env, user: { id: string; email: string }, event: SecurityEmail): D1PreparedStatement[] {
  if (env.EMAIL_ENABLED !== "1" || !deliverable(user.email)) return [];
  const now = Date.now();
  return [env.DB.prepare(
    `insert into email_outbox (id, user_id, recipient, sender, subject, body, created_at, next_attempt_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), user.id, user.email, sender(env), t("subject"),
    `${t(event)}\n\n${t("help").replace("{url}", `${env.APP_ORIGIN}/cuenta`)}`, now, now)];
}

/**
 * El código de acceso para quien estaba en la lista de espera. Sin correo configurado no se encola:
 * el operador lo ve en /admin y lo manda por su cuenta. Al enviarse, el código se borra del cuerpo.
 */
export function accessEmailStatement(env: Env, job: { id: string; name: string; email: string; code: string }): D1PreparedStatement | null {
  if (env.EMAIL_ENABLED !== "1" || mailConfigState(env) !== "configured" || !deliverable(job.email)) return null;
  const now = Date.now();
  const body = t("access").replace("{name}", job.name).replace("{code}", job.code).replace("{url}", `${env.APP_ORIGIN}/cuenta?modo=crear&siguiente=casa`);
  return env.DB.prepare(
    `insert into email_outbox (id, recipient, sender, subject, body, created_at, next_attempt_at) values (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(job.id, job.email, sender(env), t("accessSubject"), body, now, now);
}

export async function queueTestEmail(env: Env) {
  if (!isEmailAddress(env.OPERATOR_EMAIL)) throw new Error("Operator email is not configured");
  const now = Date.now();
  await env.DB.prepare(
    `insert into email_outbox (id, recipient, sender, subject, body, created_at, next_attempt_at) values (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), env.OPERATOR_EMAIL, sender(env), t("testSubject"), t("test"), now, now).run();
}

/** Atomic budget shared by all Worker isolates. Retries also spend budget. */
export async function reserveEmailBudget(env: Pick<Env, "DB">, now: number) {
  const day = new Date(now).toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  return Boolean(await env.DB.prepare(
    `insert into email_usage (day, requests)
     select ?, 1 where (select coalesce(sum(requests), 0) from email_usage where day like ?) < ?
     on conflict (day) do update set requests = requests + 1
     where requests < ? and (select coalesce(sum(requests), 0) from email_usage where day like ?) < ?
     returning requests`,
  ).bind(day, `${month}%`, EMAIL_LIMITS.monthly, EMAIL_LIMITS.daily, `${month}%`, EMAIL_LIMITS.monthly).first());
}

async function queueInactivityEmails(env: Env, now: number) {
  const from = sender(env);
  await env.DB.batch(INACTIVITY_NOTICE_DAYS.map((days, index) => {
    const window = inactivityNoticeWindow(days, index, now);
    const body = `${t("inactivity").replace("{days}", String(days))}\n\n${env.APP_ORIGIN}/familia`;
    return env.DB.prepare(
      `insert or ignore into email_outbox
       (id, user_id, household_id, notice_days, notice_due_at, recipient, sender, subject, body, created_at, next_attempt_at)
       select 'notice/' || n.household_id || '/' || n.days_before_pause || '/' || n.due_at || '/' || u.id,
              u.id, n.household_id, n.days_before_pause, n.due_at, u.email, ?, ?, ?, ?, ?
         from inactivity_notices n join households h on h.id = n.household_id
         join household_plans p on p.household_id = h.id
         join memberships m on m.household_id = h.id join "user" u on u.id = m.user_id
        where n.status = 'pending' and n.days_before_pause = ? and p.status = 'active' and u.email not like '%.invalid'
          and n.due_at = coalesce(h.last_activity_at, h.created_at) + ?
          and coalesce(h.last_activity_at, h.created_at) <= ? and coalesce(h.last_activity_at, h.created_at) > ?`,
    ).bind(from, t("inactivitySubject"), body, now, now, days, window.dueAtOffset, window.activeBefore, window.activeAfter);
  }));
}

interface EmailJob {
  id: string;
  user_id: string | null;
  household_id: string | null;
  notice_days: number | null;
  notice_due_at: number | null;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  first_attempt_at: number | null;
  attempts: number;
}

class DeliveryError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, retryable: boolean) {
    super(code);
    this.code = code;
    this.retryable = retryable;
  }
}

async function sendEmail(env: Env, job: EmailJob, request: typeof fetch) {
  let response: Response;
  try {
    response = await request("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": job.id },
      body: JSON.stringify({ from: job.sender, to: [job.recipient], subject: job.subject, text: job.body }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new DeliveryError("network", true);
  }
  if (!response.ok) throw new DeliveryError(`http-${response.status}`, response.status === 429 || response.status === 409 || response.status >= 500);
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new DeliveryError("invalid-response", true); }
  if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !body.id) {
    throw new DeliveryError("invalid-response", true);
  }
  return body.id;
}

async function noticeStillPending(env: Env, job: EmailJob, now: number) {
  if (!job.household_id) return true;
  const index = INACTIVITY_NOTICE_DAYS.findIndex(days => days === job.notice_days);
  if (index < 0 || job.notice_due_at === null) return false;
  const days = INACTIVITY_NOTICE_DAYS[index];
  const window = inactivityNoticeWindow(days, index, now);
  return Boolean(await env.DB.prepare(
    `select 1 from inactivity_notices n join households h on h.id = n.household_id
     join household_plans p on p.household_id = h.id
     join memberships m on m.household_id = h.id and m.user_id = ?
     where n.household_id = ? and n.days_before_pause = ? and n.due_at = ? and n.status = 'pending'
       and p.status = 'active' and coalesce(h.last_activity_at, h.created_at) + ? = n.due_at
       and coalesce(h.last_activity_at, h.created_at) > ?`,
  ).bind(job.user_id, job.household_id, days, job.notice_due_at, window.dueAtOffset, window.activeAfter).first());
}

/** Provider acceptance is recorded separately from inbox delivery. No tracking pixels. */
export async function processEmails(env: Env, now = Date.now(), request: typeof fetch = fetch) {
  const startedAt = Date.now();
  const config = mailConfigState(env);
  if (config !== "configured") {
    if (config === "incomplete") console.error("[mail] incomplete configuration");
    return { config, accepted: 0 };
  }
  await queueInactivityEmails(env, now);
  const candidates = await env.DB.prepare(
    `select id from email_outbox where status in ('pending', 'sending') and next_attempt_at <= ?
     order by household_id is not null, created_at limit ?`,
  ).bind(now, EMAIL_LIMITS.batch).all<{ id: string }>();
  let accepted = 0;
  for (const candidate of candidates.results) {
    const current = now + Date.now() - startedAt;
    const job = await env.DB.prepare(
      `update email_outbox set status = 'sending', next_attempt_at = ?
       where id = ? and status in ('pending', 'sending') and next_attempt_at <= ? returning *`,
    ).bind(current + 60_000, candidate.id, current).first<EmailJob>();
    if (!job) continue;
    if (!(await noticeStillPending(env, job, current))) {
      await env.DB.prepare("update email_outbox set status = 'cancelled' where id = ?").bind(job.id).run();
      continue;
    }
    if (job.first_attempt_at !== null && current - job.first_attempt_at >= RETRY_WINDOW) {
      await env.DB.prepare("update email_outbox set status = 'failed', last_error = 'delivery-unknown' where id = ?").bind(job.id).run();
      console.error("[mail] delivery-unknown", job.id);
      continue;
    }
    if (!(await reserveEmailBudget(env, current))) {
      const tomorrow = Math.floor(current / DAY) * DAY + DAY;
      await env.DB.prepare("update email_outbox set status = 'pending', last_error = 'quota', next_attempt_at = ? where id = ?").bind(tomorrow, job.id).run();
      continue;
    }
    await env.DB.prepare("update email_outbox set first_attempt_at = coalesce(first_attempt_at, ?), attempts = attempts + 1 where id = ?").bind(current, job.id).run();
    try {
      const id = await sendEmail(env, job, request);
      // Un código de acceso no queda guardado en claro una vez entregado.
      await env.DB.prepare("update email_outbox set status = 'sent', provider_id = ?, last_error = null, body = case when id like 'access/%' then '' else body end where id = ?").bind(id, job.id).run();
      accepted++;
    } catch (error) {
      if (!(error instanceof DeliveryError)) throw error;
      console.error("[mail] send failed", { id: job.id, code: error.code });
      await env.DB.prepare("update email_outbox set status = ?, last_error = ?, next_attempt_at = ? where id = ?")
        .bind(error.retryable ? "pending" : "failed", error.code, current + Math.min(3_600_000, 60_000 * 2 ** Math.min(job.attempts, 6)), job.id).run();
    }
    // At most five requests per second, below Resend's shared default rate limit.
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  await env.DB.batch([
    env.DB.prepare(
      `update inactivity_notices set status = 'sent', updated_at = ?
       where status = 'pending'
         and exists (select 1 from email_outbox e where e.household_id = inactivity_notices.household_id
           and e.notice_days = inactivity_notices.days_before_pause and e.notice_due_at = inactivity_notices.due_at and e.status = 'sent')
         and not exists (select 1 from email_outbox e where e.household_id = inactivity_notices.household_id
           and e.notice_days = inactivity_notices.days_before_pause and e.notice_due_at = inactivity_notices.due_at and e.status not in ('sent', 'cancelled'))`,
    ).bind(now),
    env.DB.prepare("delete from email_usage where day < ?").bind(new Date(now - 45 * DAY).toISOString().slice(0, 10)),
    env.DB.prepare("delete from email_outbox where status in ('sent', 'cancelled') and created_at < ?").bind(now - 30 * DAY),
  ]);
  return { config, accepted };
}

export async function mailOverview(env: Env, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const [counts, usage] = await Promise.all([
    env.DB.prepare("select status, count(*) as count from email_outbox group by status").all<{ status: string; count: number }>(),
    env.DB.prepare("select coalesce(sum(case when day = ? then requests else 0 end), 0) as daily, coalesce(sum(requests), 0) as monthly from email_usage where day like ?")
      .bind(day, `${day.slice(0, 7)}%`).first<{ daily: number; monthly: number }>(),
  ]);
  return { config: mailConfigState(env), counts: Object.fromEntries(counts.results.map(row => [row.status, row.count])), usage, limits: EMAIL_LIMITS };
}
