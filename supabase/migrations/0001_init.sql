-- StackAuditor initial schema.
--
-- Tables: waitlist, uploads, audits.
-- Every table is RLS-enabled with NO anon policy for reads -- all application
-- access goes through the service role in lib/repository.ts. The anon key is
-- only ever used for inserts the browser is allowed to make (waitlist signup).
--
-- Applied with:  supabase db push     (or paste into the SQL editor)

-- ---------------------------------------------------------------- extensions
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ waitlist
-- Landing point for SOL-6 path b: email + UTM attribution captured server-side.
create table if not exists public.waitlist (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  created_at    timestamptz not null default now()
);

comment on table public.waitlist is
  'Landing-page email capture with UTM attribution (SOL-6 path b).';
comment on column public.waitlist.utm_content is
  'Distinguishes creative/link variants within one campaign, e.g. x-thread-1 vs x-thread-2.';

create index if not exists waitlist_utm_source_idx on public.waitlist (utm_source);
create index if not exists waitlist_created_at_idx on public.waitlist (created_at desc);

-- ------------------------------------------------------------------- uploads
create table if not exists public.uploads (
  id            uuid primary key default gen_random_uuid(),
  email         text,
  mime_type     text not null,
  bytes         integer not null check (bytes > 0),
  storage_path  text not null,
  created_at    timestamptz not null default now()
);

comment on table public.uploads is
  'One row per uploaded screenshot/PDF. Bytes live in the audit-uploads storage bucket.';

create index if not exists uploads_email_idx on public.uploads (email);

-- -------------------------------------------------------------------- audits
create table if not exists public.audits (
  id            uuid primary key default gen_random_uuid(),
  upload_id     uuid references public.uploads (id) on delete set null,
  email         text not null,
  status        text not null default 'pending'
                  check (status in ('pending', 'complete', 'failed')),
  is_free       boolean not null default true,
  result        jsonb,
  -- Attribution is copied onto the audit (not just the waitlist row) so that
  -- "which channel produced a PAID audit" is answerable without a join through
  -- waitlist, which a paying user may never have been in.
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

comment on table public.audits is
  'One row per audit run. Drives the free-audit gate: count(*) where email = ?';

-- The free gate counts by email on every audit request; without this index that
-- becomes a seq scan on the hottest path in the product.
create index if not exists audits_email_idx on public.audits (email);
create index if not exists audits_utm_source_idx on public.audits (utm_source);
create index if not exists audits_created_at_idx on public.audits (created_at desc);

-- ----------------------------------------------------------------------- RLS
-- Default deny on all three tables. The service role bypasses RLS entirely, so
-- the application keeps working; these policies only constrain the anon key.
alter table public.waitlist enable row level security;
alter table public.uploads  enable row level security;
alter table public.audits   enable row level security;

-- Waitlist: anon may INSERT (public signup form) but never read.
-- Without this, a scraper with the public anon key could dump the email list.
drop policy if exists "waitlist_anon_insert" on public.waitlist;
create policy "waitlist_anon_insert"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- No select/update/delete policy for anon on waitlist -- deny by omission.

-- Uploads and audits: no anon policy at all. Reads and writes are service-role
-- only. When magic-link auth lands (Day 6-8), add an authenticated policy here:
--
--   create policy "audits_owner_select" on public.audits
--     for select to authenticated
--     using (email = auth.jwt() ->> 'email');

-- ------------------------------------------------------------------- storage
-- Private bucket for raw uploads. Not public: the audit UI fetches through a
-- signed URL minted server-side, so a leaked path is not a leaked document.
insert into storage.buckets (id, name, public)
values ('audit-uploads', 'audit-uploads', false)
on conflict (id) do nothing;

-- Storage objects are service-role only; no anon policy is created here.
