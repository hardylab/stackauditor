# StackAuditor — audit pipeline architecture

**Owner:** CTO · **Status:** scaffold (no live integrations) · **Task:** SOL-7
**Stack decision:** SOL-2 · **Repo + CI:** SOL-4 · **Attribution:** SOL-6 (path b lands here)

One page on how an uploaded screenshot becomes a paid audit, and which service
owns each step. Everything described below is scaffolded and runs today against
mocked externals; nothing here calls a paid API yet.

## Flow

```
 [browser]                                     upload → extraction → audit → gate → paywall
    │
    │ 1. POST /api/upload  (multipart: file, email?)
    ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ app/api/upload/route.ts                                     │
 │  · validates MIME (png/jpeg/webp/pdf) and size (≤ 8 MB)     │
 │  · writes bytes    → Supabase Storage (bucket audit-uploads)│
 │  · writes metadata → Supabase Postgres  (uploads)           │
 └─────────────────────────────────────────────────────────────┘
    │ { uploadId }
    │ 2. POST /api/audit  ({ uploadId, email, utm_* })
    ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ lib/audit-pipeline.ts — runAuditPipeline()                  │
 │                                                             │
 │  a. getUpload(uploadId)              → Supabase Postgres    │
 │  b. token-budget guard               → lib/anthropic.ts     │
 │  c. checkFreeGate(email)             → count(audits)        │
 │        └─ used ≥ 1  ──────────────────────────► 402 paywall │
 │  d. createAudit(status='pending')    → Supabase Postgres    │
 │  e. runAuditModel(image|pdf)         → Anthropic Claude     │
 │  f. completeAudit(id, result)        → Supabase Postgres    │
 └─────────────────────────────────────────────────────────────┘
    │ { auditId, result, isFree }              │ 402
    ▼                                          ▼
 [audit UI — Day 6-8]              3. POST /api/checkout → Stripe Checkout
                                              │
                                              ▼
                                     hosted payment page (no PCI scope)
```

## Step → service ownership

| # | Step | Service | Code |
|---|------|---------|------|
| 1 | Accept + validate upload | Vercel (Node runtime) | `app/api/upload/route.ts` |
| 2 | Store raw bytes | Supabase **Storage** (private bucket) | `lib/repository.ts` |
| 3 | Store upload metadata | Supabase **Postgres** (`uploads`) | `lib/repository.ts` |
| 4 | Extract stack + reason | **Anthropic** Claude Sonnet (vision) | `lib/anthropic.ts` |
| 5 | Free-audit gate | Supabase **Postgres** (`count(audits)`) | `lib/free-gate.ts` |
| 6 | Persist audit + attribution | Supabase **Postgres** (`audits`) | `lib/repository.ts` |
| 7 | Paywall / payment | **Stripe** Checkout (hosted) | `app/api/checkout/route.ts` |
| 8 | Waitlist + attribution | Supabase **Postgres** (`waitlist`) | `app/api/waitlist/route.ts` |

## The two seams that matter

**Anthropic (`lib/anthropic.ts`)** is the only file that talks to the model.
Three decisions are load-bearing:

- **Forced tool use, not JSON-in-prose.** The model must call `emit_audit`,
  whose schema mirrors `AuditResult`. Output is parseable by construction — no
  free-text parsing, no JSON repair path.
- **Prompt caching on the rubric.** The ~1.5k-token audit rubric is identical on
  every request and is sent with `cache_control: ephemeral`. Cache reads are
  ~90% cheaper than fresh input, which is the difference between SOL-2's
  $0.15/audit budget and roughly double it. This is the single biggest cost
  lever in the product and it costs one line.
- **Input token cap.** `exceedsTokenBudget()` rejects a pathological upload
  before it reaches the model, so one 40-page PDF cannot blow the unit economics.

**Persistence (`lib/repository.ts`)** is the only module that touches Supabase.
Route handlers never import a Supabase client directly. Going live is: set the
env vars, run the migration. No route changes.

Both seams honour `lib/env.ts` — a missing key puts that seam in **mock mode**
rather than crashing, so the entire flow is runnable end-to-end today. Every
response carries a `mode` field (`{anthropic, supabase, stripe}` → `mock|live`)
so it is never ambiguous which parts were real.

## Data model

`supabase/migrations/0001_init.sql`

**`waitlist`** — landing-page capture, the server-side home for SOL-6 path b.

| column | type | note |
|---|---|---|
| `id` | uuid pk | |
| `email` | text unique | lowercased before write |
| `utm_source` `utm_medium` `utm_campaign` `utm_content` | text | indexed on `utm_source` |
| `created_at` | timestamptz | |

**`uploads`** — one row per uploaded file.

| column | type | note |
|---|---|---|
| `id` | uuid pk | returned to the browser as `uploadId` |
| `email` | text null | optional at upload time |
| `mime_type` / `bytes` / `storage_path` | text/int/text | `bytes > 0` enforced |
| `created_at` | timestamptz | |

**`audits`** — one row per audit run; drives the free gate.

| column | type | note |
|---|---|---|
| `id` | uuid pk | |
| `upload_id` | uuid fk → uploads | `on delete set null` |
| `email` | text | **indexed** — the gate counts by email on every request |
| `status` | text | `pending` / `complete` / `failed` |
| `is_free` | boolean | |
| `result` | jsonb | the `AuditResult` payload |
| `utm_source` `utm_medium` `utm_campaign` `utm_content` | text | copied onto the audit |
| `created_at` / `completed_at` | timestamptz | |

**Why UTMs live on `audits` and not only on `waitlist`:** the question worth
answering is "which channel produced a *paying* audit". A paying user may never
have joined the waitlist, so a join through `waitlist` would silently drop them.
Copying attribution onto the audit row makes revenue-by-channel a single
`group by utm_source` with no join.

## Security posture

- **RLS on by default, deny by omission.** All three tables have RLS enabled.
  The anon key gets exactly one policy: insert into `waitlist` (the public
  signup form). No anon select anywhere — without that, anyone holding the
  public anon key could dump the email list.
- **Service-role key is server-only.** It bypasses RLS entirely and is never
  imported into a client component; `lib/supabase.ts` documents this at the
  call site.
- **Uploads bucket is private.** The audit UI will fetch through a server-minted
  signed URL, so a leaked path is not a leaked customer document.
- **Liability.** The rubric instructs plain-language, informational framing and
  forbids compliance guarantees (SOL-2 risk item). Every PDF will carry the
  same disclaimer.

## Deliberate non-goals at this stage

- No live Stripe session, Supabase project, or Anthropic call — all board-blocked
  (see `docs/audit-pipeline-deps.md`).
- No auth. Magic-link lands Day 6-8; the RLS policy stub for it is already
  written as a comment in the migration.
- No audit UI or PDF export (Day 6-8).
- The app is **not** `output: 'export'`. These are server routes and target
  Vercel; the current GitHub Pages deploy of `index.html` is untouched by this
  branch.
