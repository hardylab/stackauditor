# StackAuditor

> 1-page plain-language SaaS spend audit in 60 seconds.

Upload a screenshot of your SaaS stack. Get a 1-page audit — wasted spend,
redundant seats, unused features, security red flags — in under 60 seconds.

This repo is the canonical codebase for StackAuditor. It currently ships the v0
landing page (this run of [SOL-4](/BB4/issues/SOL-4)). The actual audit
pipeline, auth, payments, and LLM calls land in follow-up tasks.

- **Live URL (staging):** https://hardylab.github.io/stackauditor/
- **Repo:** https://github.com/hardylab/stackauditor
- **Product spec:** [SOL-2 plan](/BB4/issues/SOL-2#document-plan) on Paperclip
- **Audience + distribution:** [SOL-3 plan](/BB4/issues/SOL-3#document-plan)

## Status

- [x] Repo scaffolded.
- [x] CI (smoke checks on every PR and push).
- [x] Production URL live on GitHub Pages from `main`.
- [x] Landing page with email waitlist.
- [ ] Audit upload + LLM pipeline (Day 3-5 of the 14-day plan).
- [ ] Stripe checkout + Pro tier (Day 6-8).
- [ ] Move from Tailwind CDN to Next.js + Vercel when auth/payments ship.

## Stack

| Layer        | Choice                                | Why                                                              |
| ------------ | ------------------------------------- | ---------------------------------------------------------------- |
| Markup       | Plain HTML5                           | Zero build, zero deps, deploys straight from the repo root.      |
| Styling      | Tailwind via CDN                       | Same look as the production plan (SOL-2) without a build step.   |
| Hosting      | GitHub Pages (static, from `/`)        | Zero secrets to ship a public URL.                               |
| CI           | GitHub Actions (Node 20)              | Smoke checks on every push.                                      |
| Future host  | Vercel + Next.js 15                   | When auth, LLM, and Stripe land in Days 3-8 of the build plan.  |

The production stack from [SOL-2](/BB4/issues/SOL-2#document-plan) is
**Next.js 15 + Vercel + Supabase + Anthropic + Stripe**. We start with the
static landing page because it satisfies SOL-4 (repo + CI + deploy + public URL)
without needing any external secrets, and we graduate to the full production stack
once the audit feature lands.

## Run locally

No dependencies required — open `index.html` directly in a browser, or serve the
folder over HTTP:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

Run the smoke checks (requires Node 20+):

```bash
node scripts/smoke.mjs
```

## Deploy

Push to `main`. The `.github/workflows/deploy.yml` workflow packages the repo
root and publishes it to GitHub Pages.

Manual one-off:

```bash
gh workflow run deploy.yml
```

### How Pages is configured

Pages source is GitHub Actions (`actions/deploy-pages`). The workflow uses
`actions/configure-pages` + `actions/upload-pages-artifact` +
`actions/deploy-pages` — no secrets required.

### Promoting to a custom domain

1. Add a `CNAME` file at the repo root containing the bare domain (e.g. `stackauditor.com`).
2. Configure DNS per the GitHub Pages docs (A + AAAA records, or a CNAME to `hardylab.github.io`).
3. Enforce HTTPS in repo Settings → Pages.

## Repo ownership note

The repo currently lives under the `hardylab` GitHub personal account because
that is the only account authenticated on the build host. Move it to an org
account once the company has one (Settings → Transfer ownership). Code is
MIT-licensed.

## Roadmap (matches SOL-2 Day 1-14 plan)

1. **Day 1-2 (this PR):** Repo, CI, deploy, landing page with email capture.
2. **Day 3-5:** Upload + audit pipeline, Stripe checkout, free-audit gating.
3. **Day 6-8:** Audit result UI + PDF export + Resend email delivery.
4. **Day 9-10:** Pro subscription, monthly re-audit cron, alerts.
5. **Day 11-12:** Analytics funnel (Plausible or PostHog), error reporting, basic admin.
6. **Day 13:** Soft launch — X thread + Show HN draft (CMO-led).
7. **Day 14:** Public launch on the three SOL-3 channels.

## Kill signal (from SOL-2)

If we have < 20 paid audits AND < 500 free audits by day 30, we shut down,
document learnings, and pick a new problem in the same audience.

## Contributing

This is a one-person-company codebase. Issues and PRs are tracked in Paperclip,
not GitHub. See `/BB4/issues/SOL-4` and related tickets.
