# StackAuditor — dependency map

**Owner:** CTO · **Task:** SOL-7 · **Consumed by:** whoever provisions services + sets Vercel env vars

Every external dependency the Day 3-5 build needs, the env var it maps to, and
whether the board has to register something or the CTO can set it locally.

Tags:
- **[BLOCKER: board-registration-needed]** — needs a human to create an account,
  accept terms, or attach a payment method. CTO cannot self-serve.
- **[OWNED: can-set-locally]** — CTO sets it; no board action.

Code reads all of these through `lib/env.ts`. **A missing key is not a crash** —
it puts that seam into mock mode, which is why the scaffold runs today.

---

## Supabase — Postgres + Storage

| Env var | Purpose | Tag |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project REST URL | **[BLOCKER: board-registration-needed]** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser client, RLS-constrained | **[BLOCKER: board-registration-needed]** |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; bypasses RLS | **[BLOCKER: board-registration-needed]** |

- **Board action:** create a Supabase project (free tier), copy the three values
  from Settings → API.
- **Then CTO:** run `supabase/migrations/0001_init.sql` (`supabase db push` or
  paste into the SQL editor). Creates `waitlist`, `uploads`, `audits`, the
  private `audit-uploads` bucket, and the RLS policies.
- **Handling:** `SUPABASE_SERVICE_ROLE_KEY` is a full-database bypass. It belongs
  only in Vercel server-side env (never `NEXT_PUBLIC_*`, never in the client
  bundle). If it ever appears in a browser build, rotate it immediately.
- **Blocks:** persistence of every table, upload storage, the free-audit gate,
  and SOL-6 path b (server-side UTM capture).

## Anthropic — the audit model

| Env var | Purpose | Tag |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude Sonnet vision + structured audit | **[BLOCKER: board-registration-needed]** |

- **Board action:** create an Anthropic Console account, attach billing, mint an
  API key. **This one has a real running cost** — roughly $0.15/audit at Sonnet
  pricing before prompt caching, materially less after (the rubric is cached).
- **Recommend:** set a monthly spend cap in the console at 2× the expected
  volume. At the SOL-2 target of 1,000 free audits that is ~$150/mo of exposure;
  a cap turns a bug or an abuse spike into a failed request instead of an
  invoice.
- **Blocks:** real audit output. Until it lands, `runAuditModel()` returns the
  `MOCK_AUDIT` fixture and every response is flagged `"mocked": true`.

## Stripe — payments

| Env var | Purpose | Tag |
|---|---|---|
| `STRIPE_SECRET_KEY` | Create Checkout sessions | **[BLOCKER: board-registration-needed]** |
| `STRIPE_WEBHOOK_SECRET` | Verify webhook signatures | **[BLOCKER: board-registration-needed]** |
| `STRIPE_PRICE_ONE_TIME` | Price id — $19 single audit | **[BLOCKER: board-registration-needed]** |
| `STRIPE_PRICE_PRO` | Price id — $9/mo Pro | **[BLOCKER: board-registration-needed]** |

- **Board action:** create a Stripe account (identity + bank details — the
  longest lead time of anything on this page, plan for days not minutes), then
  create two Products: one-time $19, recurring $9/mo. Copy both price ids.
- **Note:** the webhook secret only exists after the endpoint is created, so it
  is a second pass after the app has a stable URL.
- **Blocks:** taking money. `/api/checkout` currently returns a placeholder URL
  shaped exactly like the live response and flagged `"stubbed": true`, so the
  paywall flow is clickable end-to-end without it.

## Resend — audit delivery (Day 6-8, listed for completeness)

| Env var | Purpose | Tag |
|---|---|---|
| `RESEND_API_KEY` | Email the audit PDF | **[BLOCKER: board-registration-needed]** |

- **Board action:** Resend account + verify the sending domain (DNS records).
  Domain verification is slow; worth starting early even though delivery is a
  Day 6-8 concern.

## Vercel — hosting

| Item | Purpose | Tag |
|---|---|---|
| Vercel project linked to the repo | Preview + production deploys | **[BLOCKER: board-registration-needed]** |
| `NEXT_PUBLIC_SITE_URL` | Absolute URLs for Stripe redirects | **[OWNED: can-set-locally]** |

- **Board action:** create the Vercel account, install the GitHub app, import
  `hardylab/stackauditor`, set the env vars above.
- **This is why SOL-7 has no preview URL.** No Vercel project exists and the
  Vercel CLI is not installed on the build host, so a preview deploy is not
  something the CTO can produce. Verification was done locally instead — see
  `scripts/scaffold-check.mjs`.
- **Deploy note:** the existing GitHub Pages deploy of `index.html` is unchanged
  by this branch. Vercel would host the app routes; Pages continues to serve the
  marketing page until we decide to consolidate.

## Locally owned — no board action

| Item | Env var | Tag |
|---|---|---|
| Mock mode switch | `MOCK_EXTERNAL=1` | **[OWNED: can-set-locally]** |
| Site URL for local dev | `NEXT_PUBLIC_SITE_URL` | **[OWNED: can-set-locally]** |
| Upload limits (8 MB, MIME allowlist) | `lib/limits.ts` | **[OWNED: can-set-locally]** |
| Free-audit count | `FREE_AUDITS_PER_EMAIL` in `lib/limits.ts` | **[OWNED: can-set-locally]** |
| Token budget cap | `MAX_INPUT_TOKENS` in `lib/limits.ts` | **[OWNED: can-set-locally]** |
| DB schema + RLS | `supabase/migrations/0001_init.sql` | **[OWNED: can-set-locally]** |

---

## Summary

**Board-blocked (6 registrations):** Supabase, Anthropic, Stripe, Resend, Vercel,
plus the Stripe webhook endpoint as a follow-up pass.

**Critical path to a working paid product:** Supabase → Anthropic → Stripe.
Supabase and Anthropic together unblock a *working free product*; Stripe is only
needed to charge for it. Stripe has the longest lead time (bank verification),
so start it first even though it is needed last.

**Not blocked:** the entire scaffold. Schema, routes, pipeline, free-gate,
paywall handoff, and UTM capture are written, typechecked, and verified against
mocked externals (22/22 checks in `scripts/scaffold-check.mjs`).

## Env var quick reference

```bash
# Supabase              [BLOCKER]
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, bypasses RLS

# Anthropic             [BLOCKER]  — set a spend cap in the console
ANTHROPIC_API_KEY=

# Stripe                [BLOCKER]
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ONE_TIME=
STRIPE_PRICE_PRO=

# Resend                [BLOCKER]  — Day 6-8
RESEND_API_KEY=

# Owned locally
NEXT_PUBLIC_SITE_URL=http://localhost:3000
MOCK_EXTERNAL=1                 # force mock mode even if keys exist
```

---

## Strategic pivot — heartbeat 14 (2026-08-07)

CEO decided **build first, launch later**: continue scaffolding to a launchable
state without waiting for the board's integration keys. Plausible + Formspree
(SOL-5 / SOL-6) were deprioritised for now; the waitlist form will point at
`/api/waitlist` instead of Formspree once Supabase is live (Q4 confirmed).

This page is unchanged in spirit — every row below is a "wire at launch" item,
not a "block on this to start work" item.
