# StackAuditor launch runbook

**Owner:** CTO  **Task:** SOL-9  **Use this:** when the board hands you the first batch of keys

This is the *HOW*. [`audit-pipeline-deps.md`](./audit-pipeline-deps.md) is the *WHAT*.
The runbook assumes the scaffold is merged and you have:

- a Vercel project linked to the `hardylab/stackauditor` repo,
- the local repo on `main` (or the release branch),
- this runbook open on a second screen.

The steps are ordered by **dependency**, not by the order the board can move.
You start **Step 1 the moment a Supabase project exists**; you do **not** wait
for Stripe. Steps are also individually rollback-able: if the smoke at the end
of a step fails, the section tells you how to revert to the prior state without
taking the site down.

Each step lists **who owns the action** `[BOARD]` or `[CTO]` so there is no
ambiguity about which one of you is on the hook.

**Pre-flight (before you start step 1):**

```bash
cd "$(git rev-parse --show-toplevel)"
git checkout main && git pull --ff-only
git status
node scripts/preflight-check.mjs
```

If preflight fails, fix that first. Don't go live on a scaffold that doesn't
pass its own smoke.

---

## Step 1 Supabase (persistence + uploads)

**Why first.** Every other seam writes through `lib/repository.ts`. Until
Supabase is live, `isMockMode.supabase` is true and the in-memory `mock-store`
holds the data which resets on every deploy. Going live without Supabase
loses user data within minutes.

### 1.1 Board create the project

`[BOARD]` Create a Supabase project (free tier is fine for v1):

1. https://supabase.com/dashboard **New project**.
2. Region: pick the same region as your Vercel deploy (defaults to `us-east-1`; match it).
3. Save the **database password** in your password manager. You will not see it again.
4. Wait for the project to come up (~90 s). Status moves from `Creating` to `Active` on the dashboard.

Then copy three values from **Settings API**:

- `Project URL` `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role secret` `SUPABASE_SERVICE_ROLE_KEY`

Hand the values to the CTO through whatever secure channel you normally use
(1Password / encrypted note). **Never paste the service-role key into chat or issue comments.**

### 1.2 CTO apply the schema

`[CTO]` From the repo root:

```bash
# Option A: paste the SQL into the Supabase SQL editor (always works).
# Open supabase/migrations/0001_init.sql, copy, paste, run.

# Option B: use the Supabase CLI if installed locally.
supabase db push --db-url "postgresql://postgres:<PASSWORD>@db.<REF>.supabase.co:5432/postgres"
```

Expected output:

```
supabase/migrations/0001_init.sql applied
```

### 1.3 CTO verify schema

`[CTO]` In the Supabase **Table Editor** you should see:

- `public.waitlist` (with `email` UNIQUE, `utm_*` columns, `created_at`)
- `public.uploads` (with `storage_path`, `mime_type`, `bytes`)
- `public.audits` (with `status` enum check, `is_free`, `result jsonb`, attribution columns)
- Storage bucket `audit-uploads` (**Private**, not Public)

Then check RLS:

```sql
-- In the SQL editor:
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('waitlist', 'uploads', 'audits');
```

Every row must show `rowsecurity = true`. If `uploads` or `audits` shows `false`, do **not** proceed; re-run the migration.

### 1.4 CTO set the env vars in Vercel

`[CTO]` In the Vercel project **Settings Environment Variables**, add the three Supabase values. Scope them to **all environments** (Production, Preview, Development) unless you specifically want them isolated.

The `service_role` key is a full-database bypass. It belongs **only** in server-side env (no `NEXT_PUBLIC_` prefix, not in the browser bundle). If you ever see it referenced from a client component, rotate the key in the Supabase dashboard **immediately** and re-issue.

Trigger a redeploy (or wait for the next push). Vercel will not pick up new env vars until a new build runs.

### 1.5 Smoke

`[CTO]` Against the **production** URL (not preview; same code path but `NEXT_PUBLIC_*` values need the build to be the right one):

```bash
curl -sS -X POST https://stackauditor.com/api/waitlist \n  -H 'Content-Type: application/json' \n  -d '{"email":"smoke-1@example.com","utm_source":"launch-smoke"}'
```

Expected:

- HTTP `201`
- body contains `"created":true`
- the row appears in `public.waitlist` in the Supabase dashboard
- the same call returns `"created":false` (upsert by email)

```bash
node scripts/preflight-check.mjs --base https://stackauditor.com
```

Expect `mode.supabase === "live"` in the per-seam output. If it still says `mock`, the env vars did not propagate; re-check Vercel env scope and redeploy.

### Rollback

1. Remove the three Supabase env vars from Vercel (or rename them to `NEXT_PUBLIC_SUPABASE_URL_BAK` etc.).
2. Redeploy. `isMockMode.supabase` flips back to `true`; the scaffold runs against the in-memory store again.
3. The board does **not** need to delete the Supabase project; the scaffold simply ignores it.

No user-visible data is lost (the mock store held nothing the user trusted). **Do not** drop the Supabase tables; the migration is idempotent.

---

## Step 2 Anthropic (the audit model)

**Why second.** With Supabase live, the upload + audit rows persist, but every audit returns `MOCK_AUDIT` until Anthropic lands. A working **free** product without Anthropic is just a contact form; with it, you can run real free audits and validate the funnel.

### 2.1 Board mint the API key

`[BOARD]` In the Anthropic Console:

1. https://console.anthropic.com/settings/keys **Create Key**.
2. Name it `stackauditor-prod`.
3. Workspace: the one tied to billing.
4. **Before saving:** go to https://console.anthropic.com/settings/limits and set a **monthly spend cap**. Recommendation: **2x expected volume**. At the SOL-2 target of 1,000 free audits/month at ~$0.15/audit, that is ~$300/mo of exposure; a cap converts a bug or an abuse spike into a failed request instead of a runaway invoice.

Hand the `sk-ant-...` key to the CTO via 1Password.

### 2.2 CTO set the env var

`[CTO]` In Vercel **Settings Environment Variables**, add:

```
ANTHROPIC_API_KEY = sk-ant-...
```

Redeploy.

### 2.3 Smoke

`[CTO]` Upload a real screenshot and run a real audit:

```bash
# 1. upload
UPLOAD=$(curl -sS -X POST https://stackauditor.com/api/upload \n  -F file=@./fixtures/stack-screenshot.png \n  -F email=smoke-2@example.com)

UPLOAD_ID=$(echo "$UPLOAD" | jq -r .uploadId)
B64=$(base64 -w 0 ./fixtures/stack-screenshot.png)

# 2. audit (passes base64 directly; route accepts it while storage stays live too)
curl -sS -X POST https://stackauditor.com/api/audit \n  -H 'Content-Type: application/json' \n  -d "{\"uploadId\":\"$UPLOAD_ID\",\"email\":\"smoke-2@example.com\",\"base64\":\"$B64\"}" \n  | jq '{mocked, auditId, tools: .result.detected_tools | length, findings: .result.findings | length, mode}'
```

Expected:

- `mocked: false`
- `mode.anthropic: "live"` (and `mode.supabase: "live"` from step 1)
- `tools >= 1`, `findings >= 1`
- The same row appears in `public.audits` with `status='complete'` and the real `result` JSON populated.

Cost-check: in the Anthropic console usage page, the request should appear with non-zero input and output tokens and (because the rubric is cached) `cache_read_input_tokens > 0` on the second call.

### Rollback

1. Delete `ANTHROPIC_API_KEY` from Vercel env.
2. Redeploy.
3. `isMockMode.anthropic` flips back to `true`; `/api/audit` returns `MOCK_AUDIT` again. No data corruption; existing real audits stay complete; new ones are flagged `mocked: true`.

The key can be revoked in the Anthropic console if it ever leaks. Revoking is a no-op on the scaffold (it just re-mocks) but the new key needs to be re-minted and re-set.

---

## Step 3 Stripe products + prices (taking money)

**Why third.** Stripe has the **longest lead time** of anything in this runbook (identity + bank verification can take days). Start this on day 1 even though you do not need it until step 4. The two Products + three env vars can be configured before the app has a stable URL.

**Important:** Step 3 covers products + Checkout. The **webhook** (Step 4) is a separate step that depends on a stable app URL.

### 3.1 Board create the Stripe account + verify

`[BOARD]`

1. https://dashboard.stripe.com/register create the account.
2. Complete **identity verification** (drivers licence / passport + selfie).
3. Add a **bank account** for payouts (micro-deposit verification: 1-2 business days).
4. Toggle **Test mode** off before creating the live products below; the price IDs will be `price_...` in both modes but only the live ones work against real cards.

### 3.2 Board create the two Products

`[BOARD]` In **Products Add product**:

**Product 1 Single audit**

- Name: `StackAuditor Single audit`
- Description: `One SaaS spend audit. Plain-language findings, ~60 seconds.`
- Pricing model: **One-time**
- Price: **$19.00 USD**
- Tax: Sales tax collection: leave default for now
- Copy the **price ID** (`price_1N...`) hand to CTO as `STRIPE_PRICE_ONE_TIME`

**Product 2 Pro (monthly re-audit)**

- Name: `StackAuditor Pro`
- Description: `Monthly re-audits against your latest stack. Cancel anytime.`
- Pricing model: **Recurring**
- Price: **$9.00 USD** every **month**
- Copy the **price ID** hand to CTO as `STRIPE_PRICE_PRO`

### 3.3 Board mint the secret key

`[BOARD]` In **Developers API keys**:

- Copy the **Secret key** (`sk_live_...`) hand to CTO as `STRIPE_SECRET_KEY`.

### 3.4 CTO set the three env vars

`[CTO]` In Vercel **Settings Environment Variables**, add:

```
STRIPE_SECRET_KEY      = sk_live_...
STRIPE_PRICE_ONE_TIME  = price_1N...
STRIPE_PRICE_PRO       = price_1M...
```

Redeploy.

### 3.5 CTO enable the live Checkout path

`[CTO]` In `app/api/checkout/route.ts`, the live path is currently commented out. **Delete the early `return Response.json(...stubbed...)` and uncomment the `stripe.checkout.sessions.create({...})` block.**

The diff is roughly:

```diff
- if (isMockMode.stripe) {
-   return Response.json({ checkoutUrl: ..., stubbed: true, ... });
- }
+ if (isMockMode.stripe) {
+   return Response.json({ checkoutUrl: ..., stubbed: true, ... });
+ }
+
+ const stripe = new Stripe(env.stripeSecretKey!);
+ const session = await stripe.checkout.sessions.create({
+   mode: plan.mode,
+   customer_email: email,
+   line_items: [{
+     price: planId === 'pro' ? env.stripePricePro! : env.stripePriceOneTime!,
+     quantity: 1,
+   }],
+   success_url: env.siteUrl + '/audit?session_id={CHECKOUT_SESSION_ID}',
+   cancel_url: env.siteUrl + '/#pricing',
+ });
+ return Response.json({ checkoutUrl: session.url, sessionId: session.id, stubbed: false });
```

You will also need to import `Stripe` from the `stripe` package at the top of the file. Commit on a branch, push, let Vercel deploy the preview, and verify there before promoting.

### 3.6 Smoke

`[CTO]` Against the production URL:

```bash
curl -sS -X POST https://stackauditor.com/api/checkout \n  -H 'Content-Type: application/json' \n  -d '{"email":"smoke-3@example.com","plan":"one_time"}' \n  | jq '{checkoutUrl, stubbed, sessionId, mode}'
```

Expected:

- `stubbed: false`
- `mode.stripe: "live"`
- `checkoutUrl` starts with `https://checkout.stripe.com/...` (NOT your `/checkout/placeholder` mock URL)
- Opening the URL shows the real Stripe Checkout page with the $19 line item

```bash
node scripts/preflight-check.mjs --base https://stackauditor.com
```

**Expect** `mode.stripe: "live"` in the per-seam output. (The preflight script still POSTs to `/api/checkout` in mock because we have not changed the mock branch; what changes is the *production* response. To smoke-test the live path you must hit the production URL.)

### Rollback

1. Delete the three `STRIPE_*` env vars from Vercel.
2. Re-comment the `stripe.checkout.sessions.create` block in `app/api/checkout/route.ts` and un-flip the early return. Commit + push.
3. `/api/checkout` falls back to the placeholder URL. The paywall flow stays clickable end-to-end.

The Stripe account itself can stay; nothing destructive on the Stripe side.

---

## Step 4 Stripe webhook (marking audits as paid)

**Why last.** The webhook secret only exists **after** you register the endpoint, and you can only register an endpoint against a **stable URL** not a Vercel preview that changes per commit. By step 4, production is on its real domain.

This step landed as part of [SOL-10](/SOL/issues/SOL-10). The route is at
`app/api/webhooks/stripe/route.ts` and the schema lives in
`supabase/migrations/0002_processed_webhook_events.sql` (extends the `audits`
table with `stripe_event_id` / `stripe_session_id` / `paid_at` and adds the
`pending_payment` and `paid` status values; creates a new
`processed_webhook_events` table for the idempotency dedupe).

### 4.1 Board apply migration 0002

`[BOARD]` Open the Supabase **SQL editor** for this project and paste in the
contents of `supabase/migrations/0002_processed_webhook_events.sql`. Run it.

Expected:

```
Success. No rows returned
```

Then check that the new structure is there:

```sql
select column_name from information_schema.columns
where table_name = 'audits' and column_name in ('stripe_event_id', 'stripe_session_id', 'paid_at');

select enum_range(null::text); -- should now include 'pending_payment' and 'paid'

select tablename from pg_tables where tablename = 'processed_webhook_events';
```

All three queries should return the expected rows. If `processed_webhook_events`
is missing, the migration was rejected -- paste the error back here and we will
fix and re-run.

### 4.2 Board register the endpoint

`[BOARD]` In Stripe **Developers Webhooks Add endpoint**:

- **Endpoint URL:** `https://stackauditor.com/api/webhooks/stripe`
- **API version:** match what the Stripe SDK in `package.json` was built against. As of writing: `2024-06-20`.
- **Events to send:**
  - `checkout.session.completed`

> We deliberately do **not** subscribe to `invoice.paid` /
> `customer.subscription.deleted` yet -- Pro-tier churn handling is a separate
> SOL scoped after launch data shows churn is real. Adding them now would mean
> the route 200s while doing nothing, which masks bugs.

After creating the endpoint, click **Reveal** under **Signing secret** and copy the `whsec_...` value hand to CTO as `STRIPE_WEBHOOK_SECRET`.

### 4.3 CTO enable the live Checkout path

`[CTO]` In `app/api/checkout/route.ts` the live `stripe.checkout.sessions.create(...)` block is already written out (commented out). Do two things:

1. Delete the early `if (isMockMode.stripe) return Response.json(...stubbed...)` block.
2. Uncomment the live Stripe call.

The diff is roughly:

```diff
- if (isMockMode.stripe) {
-   return Response.json({ checkoutUrl: ..., stubbed: true, ... });
- }
+ if (isMockMode.stripe) {
+   return Response.json({ checkoutUrl: ..., stubbed: true, ... });
+ }
+
+ const stripe = new Stripe(env.stripeSecretKey!);
+ const session = await stripe.checkout.sessions.create({
+   mode: plan.mode,
+   customer_email: email,
+   client_reference_id: audit.id,       // join key for the webhook
+   metadata: { audit_id: audit.id },    // belt and braces
+   line_items: [{
+     price: planId === 'pro' ? env.stripePricePro! : env.stripePriceOneTime!,
+     quantity: 1,
+   }],
+   success_url: env.siteUrl + '/audit?session_id={CHECKOUT_SESSION_ID}',
+   cancel_url: env.siteUrl + '/#pricing',
+ });
+ return Response.json({ checkoutUrl: session.url, sessionId: session.id, clientReferenceId: audit.id, auditId: audit.id, stubbed: false });
```

The `audit` row in `pending_payment` is already created BEFORE the early return -- the new code can reference it directly.

You will also need to import `Stripe` from the `stripe` package at the top of the file (already imported in `app/api/webhooks/stripe/route.ts`, copy that line). Commit on a branch, push, let Vercel deploy the preview, and verify there before promoting.

### 4.4 CTO set the webhook env var

`[CTO]` Vercel **Settings Environment Variables**:

```
STRIPE_WEBHOOK_SECRET = whsec-...
```

Redeploy. Without this, the route returns 503 (board-config error, not bug).

### 4.5 Smoke (Stripe CLI replay)

`[CTO]` Install the Stripe CLI on the build host:

```bash
brew install stripe/stripe-cli/stripe   # mac
# or scoop install stripe                # windows
stripe login
stripe listen --forward-to https://stackauditor.com/api/webhooks/stripe
```

In a second terminal, replay a real-looking event against the `cs_live_...` session id you got from `/api/checkout`:

```bash
# Replace cs_live_... with the real id from the checkout response (Step 3.6).
stripe trigger checkout.session.completed --add checkout_session:cs_live_xxxxxxxx
```

Expected:

- The `stripe listen` terminal shows a delivery succeeding with `200` from your endpoint.
- A row in `public.audits` flips from `pending_payment` to `paid` (NOT `complete` -- those are different rows; `paid` is the webhook marker, the user-facing audit is still produced by a separate `/api/audit` call).

Run the full preflight in mock mode to confirm the conversion pipeline in aggregate:

```bash
MOCK_EXTERNAL=1 node scripts/preflight-check.mjs --base https://stackauditor.com
```

The preflight now covers the webhook path (`pending_payment -> paid` flip + idempotency replay), so a green run is the strongest signal you can get short of a real card.

For the prod checks that the preflight cannot run (signature verify on a real signed payload), confirm via SQL:

```sql
select email, status, is_free, stripe_event_id, stripe_session_id, paid_at
from public.audits
where stripe_event_id is not null
order by paid_at desc
limit 5;
```

The output should show `status = 'paid'` with a non-null `stripe_event_id` and `paid_at`.

### Rollback

1. Delete `STRIPE_WEBHOOK_SECRET` from Vercel. The route returns 503 instead of 400, but either way Stripe counts it as a failed delivery and **retries** for up to 3 days.
2. Disable the endpoint in the Stripe dashboard to stop the retries.
3. Paid audits stay `pending_payment`; the user can re-trigger via the success page on next session. The idempotency table `processed_webhook_events` will keep duplicates from re-flipping once you re-enable.
4. No code rollback needed: the route is correct, just unconfigured.

---

## Step 5 Pre-launch smoke (final integrated check)

**Why last.** All four seams live; no real user has hit the site yet. This is the single biggest-blast-radius step: an integrated end-to-end pass through the live product with real (board-supplied) test cards.

### 5.1 Pre-flight (no real card yet)

`[CTO]`

```bash
# 1. Typecheck still clean after Steps 1-4.
pnpm typecheck

# 2. Mock-mode preflight still green.
node scripts/preflight-check.mjs

# 3. The route surface has not regressed.
node scripts/scaffold-check.mjs --base http://127.0.0.1:3000   # local dev
```

### 5.2 End-to-end live audit

`[CTO]` With the dev server running against **production env vars** (set them in `.env.local` with `MOCK_EXTERNAL=` *unset* they are real keys now):

```bash
# A. upload a real screenshot
UPLOAD=$(curl -sS -X POST http://127.0.0.1:3000/api/upload \n  -F file=@./fixtures/stack-screenshot.png \n  -F email=final-smoke@example.com)

UPLOAD_ID=$(echo "$UPLOAD" | jq -r .uploadId)
B64=$(base64 -w 0 ./fixtures/stack-screenshot.png)

# B. run the audit (real Anthropic, real Supabase write)
RESP=$(curl -sS -X POST http://127.0.0.1:3000/api/audit \n  -H 'Content-Type: application/json' \n  -d "{\"uploadId\":\"$UPLOAD_ID\",\"email\":\"final-smoke@example.com\",\"base64\":\"$B64\"}")

echo "$RESP" | jq '{mocked, auditId, mode, tools: .result.detected_tools | length}'

# C. confirm the row landed in Postgres with mode: live on every field.
psql "$DATABASE_URL" -c \n  "select email, status, is_free, utm_source from public.audits where email = 'final-smoke@example.com';"
```

Expected:

- `mocked: false`
- `mode: { anthropic: "live", supabase: "live", stripe: "live" }`
- Exactly one row in `audits` for `final-smoke@example.com`, status `complete`.

### 5.3 Paid-audit path

`[CTO]` With Stripe in **test mode** (use the `sk_test_...` keys + test price IDs in Vercel **Preview** environment for this step), and a Stripe test card `4242 4242 4242 4242`:

```bash
CHECKOUT=$(curl -sS -X POST https://stackauditor.com/api/checkout \n  -H 'Content-Type: application/json' \n  -d '{"email":"paid-smoke@example.com","plan":"one_time"}')

CHECKOUT_URL=$(echo "$CHECKOUT" | jq -r .checkoutUrl)
echo "Open: $CHECKOUT_URL"
# Open in browser, complete payment with 4242 card.
```

Then verify:

```sql
select email, is_free, status, stripe_session_id
from public.audits
where email = 'paid-smoke@example.com';
```

Expect `is_free = false` (or, if the audit has not run yet, `is_free` from the eventual audit row is `false`).

### 5.4 Marketing unblock

`[CTO]` Only after Steps 5.2 + 5.3 both pass, post a comment on the launch issue telling the CMO that paid traffic is safe to send. Include:

- The production URL
- The first free-audit limit (`FREE_AUDITS_PER_EMAIL = 1`) so the CMO messaging matches
- The current Anthropic spend cap, so CMO can sanity-check any spike

### Rollback (whole-launch)

If any of 5.2 / 5.3 fails *after* you started sending traffic:

1. **Stop the bleeding first.** Flip the pricing card on `index.html` to show waitlist instead of buy now; one commit, one push, one minute.
2. **Revert one env var at a time** using each steps individual rollback.
3. **Communicate.** Drop a comment on the launch issue with what broke, what you reverted, and the new ETA. Do not silently retry.

---

## Appendix A Failure-mode cheatsheet

| Symptom | Likely cause | First thing to check |
|---|---|---|
| `/api/audit` returns `mocked: true` after Step 2 | `ANTHROPIC_API_KEY` not in scope | Vercel env scope; redeploy with cache cleared |
| `/api/upload` 500s with Storage upload failed | Bucket name typo or service-role key wrong | `serviceClient().storage.listBuckets()`; verify bucket name is `audit-uploads` |
| `/api/checkout` returns `stubbed: true` after Step 3 | Early-return in `route.ts` not removed | Read the file; the live block must be **un-commented**, not just present |
| Webhook returns 400 immediately | `STRIPE_WEBHOOK_SECRET` mismatch or signature header missing | Re-copy from Stripe dashboard; secrets are scoped per endpoint |
| Webhook returns 503 (not 400) | `STRIPE_WEBHOOK_SECRET` or `STRIPE_SECRET_KEY` not set in Vercel env | Both are required for signature verification; set and redeploy |
| Stripe-cli shows 500 from webhook | Idempotency insert or markAuditPaid threw | Check Vercel function logs for the thrown error; usually a Postgres issue (audit row not found) |
| Spend spikes in Anthropic | Prompt not cached or rubric grew | Check `cache_read_input_tokens > 0`; if 0, the rubric changed and lost the `cache_control` marker |
| `audits` row stuck on `pending` | Model call threw after row was created | `result: null` in DB; rerun `/api/audit` with same `uploadId` (free-gate uses the pending row, idempotent) |

## Appendix B Owner / contact

| Role | Who | What they own |
|---|---|---|
| Board | Hardy | Account creation, identity verification, bank details, key minting, spend caps |
| CTO | (this agent) | Vercel env, schema migration, code edits to enable live paths, smoke verification |
| CMO | (other agent) | Marketing copy, distribution channels, traffic pacing |

The boards lead-time bottleneck is Stripe bank verification. Start that on day 1 even though it is needed last.
