-- Stripe webhook idempotency + paid-audit plumbing.
--
-- Applied AFTER 0001_init.sql. Two changes:
--
--   1. A new `processed_webhook_events` table that records every Stripe event id
--      we have already handled. The webhook route does an INSERT ON CONFLICT
--      for dedupe; if the conflict fires the event has already been processed
--      and we short-circuit with 200 OK + an already_processed log line. This is
--      the safety net for Stripe's automatic retries (it retries on non-2xx
--      for up to 3 days).
--
--   2. The `audits` table grows the columns the webhook needs: pending_payment
--      and paid are added to the status check constraint; stripe_event_id,
--      stripe_session_id, paid_at give us traceability. They are all nullable
--      so 0001's existing rows keep working unchanged.
--
-- Reason this stays separate from 0001: any change to the audits status enum
-- has to wait for audit rows to drain. The two new statuses are additive
-- (existing rows are still `pending | complete | failed`), so this is safe
-- to apply on a live DB.
--
-- RLS: deny everything from anon; the service role bypasses RLS, so the webhook
-- route keeps working without a policy. New policies should be added when
-- magic-link auth lands.

-- ---------------------------------------------------------------------- enum
-- Extend the status check constraint to include the two new lifecycle states
-- a paid audit passes through (`pending_payment` while the Checkout session is
-- open; `paid` after the webhook lands). Existing rows that are already
-- `complete` / `failed` stay valid; the constraint just admits the new values.
alter table public.audits drop constraint if exists audits_status_check;
alter table public.audits
  add constraint audits_status_check
  check (status in ('pending', 'pending_payment', 'paid', 'complete', 'failed'));

comment on column public.audits.status is
  'Lifecycle: pending (created before model call) -> complete / failed once the model returns; '
  'pending_payment (created when a Stripe Checkout session is opened, before webhook lands) '
  '-> paid once /api/webhooks/stripe receives checkout.session.completed. '
  'is_free drives which path a row took.';

-- ------------------------------------------------------------ new columns
alter table public.audits
  add column if not exists stripe_event_id    text,
  add column if not exists stripe_session_id  text,
  add column if not exists paid_at            timestamptz;

comment on column public.audits.stripe_event_id is
  'event.id of the Stripe webhook that flipped this row to paid. '
  'Indexed (uniquely per row) so a duplicate event is detectable even before processed_webhook_events is consulted.';
comment on column public.audits.stripe_session_id is
  'session.id of the Checkout session that paid for this audit. '
  'Set at session creation by /api/checkout so the webhook can join even if client_reference_id is missing.';
comment on column public.audits.paid_at is
  'When the webhook marked this row paid. Null for free audits and never-completed rows.';

-- Lookups on /api/webhooks/stripe hit audits by id (from client_reference_id)
-- and by stripe_session_id. Stripe sends the same session id multiple times
-- during one flow (completed, then async payment events), so this index is hot.
create unique index if not exists audits_stripe_event_id_idx
  on public.audits (stripe_event_id)
  where stripe_event_id is not null;
create unique index if not exists audits_stripe_session_id_idx
  on public.audits (stripe_session_id)
  where stripe_session_id is not null;

-- ----------------------------------------------- processed_webhook_events
-- Idempotency dedupe table. event_id is Stripe's evt_... string. We INSERT ON
-- CONFLICT DO NOTHING and treat the conflicting row as "already processed" --
-- even if two pods race, only one of them can claim the slot, and the loser
-- gets a `false` back from tryRecordProcessedWebhook() and short-circuits to
-- 200 OK without re-running the side effects.
create table if not exists public.processed_webhook_events (
  id            text primary key,
  source        text not null default 'stripe',
  processed_at  timestamptz not null default now()
);

comment on table public.processed_webhook_events is
  'Every Stripe event id the webhook route has handled. INSERT here is the '
  'idempotency gate -- a conflicting insert means this event id was already '
  'processed and we must not re-run the side effect.';

create index if not exists processed_webhook_events_processed_at_idx
  on public.processed_webhook_events (processed_at desc);

-- -------------------------------------------------------------- RLS / deny
-- The route handler uses the service role (lib/supabase.ts), which bypasses
-- RLS, so we do NOT create any anon / authenticated policies here. Enabling
-- RLS on the new table just makes sure a leaked anon key cannot dump the
-- event-log (which contains Stripe internal ids).
alter table public.processed_webhook_events enable row level security;

-- When magic-link auth lands (Day 6-8), add an authenticated read policy:
--
--   create policy "processed_webhook_events_owner_read"
--     on public.processed_webhook_events
--     for select to authenticated
--     using (exists (
--       select 1 from public.audits a
--       where a.stripe_event_id = processed_webhook_events.id
--         and a.email = auth.jwt() ->> 'email'
--     ));
