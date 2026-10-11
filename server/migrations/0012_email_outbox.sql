create table email_outbox (
  id text primary key,
  user_id text references "user" (id) on delete set null,
  household_id text references households (id) on delete cascade,
  notice_days integer,
  notice_due_at integer,
  recipient text not null,
  sender text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  created_at integer not null,
  next_attempt_at integer not null,
  first_attempt_at integer,
  attempts integer not null default 0,
  provider_id text,
  last_error text
);
create index email_outbox_pending_idx on email_outbox (status, next_attempt_at);
create index email_outbox_notice_idx on email_outbox (household_id, notice_days, notice_due_at);

-- Counts provider requests conservatively, including retries. UTC calendar days.
create table email_usage (
  day text primary key,
  requests integer not null
);
