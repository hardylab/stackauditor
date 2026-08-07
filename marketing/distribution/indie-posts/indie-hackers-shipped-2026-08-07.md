---
channel: indie
piece_slug: indie-hackers-shipped-2026-08-07
utm_content: indie-hackers-shipped-2026-08-07
target_url: https://hardylab.github.io/stackauditor/?utm_source=indie&utm_medium=indiehackers-post&utm_campaign=stackauditor&utm_content=indie-hackers-shipped-2026-08-07
status: scheduled
live_url: 
posted_at: 
---

# Shipped: StackAuditor — 1-page SaaS spend audit in 60 seconds

**Post title:** `Shipped: StackAuditor — 1-page SaaS spend audit from a screenshot in 60s`

**Tags:** `indie`, `ship`, `ai`, `saas`

**Post body (<= 200 words):**

Just shipped StackAuditor.

**Problem.** The average 5-person agency runs 27 SaaS tools. Nobody audits
them. Existing tools (Zylo, Productiv, Torii) want a Salesforce integration
and a 30-day implementation — wrong shape for a solo operator.

**What we built.** Upload a PNG or PDF of any SaaS dashboard. Get a 1-page
plain-language audit — wasted spend, redundant seats, unused features, top
security red flags — back in under 60s. PDF in your inbox. Free first
audit, no card.

- Vision + LLM stack: Claude Sonnet via the API
- Auth + storage: Supabase (magic-link + Postgres)
- Payments: Stripe Checkout
- Email: Resend
- Free hosting: Vercel + GitHub Pages

**What is missing:**
- Screenshot OCR is best-effort on small fonts and non-English UIs. We flag
  low-confidence reads and ask you to label tools.
- This is informational, not advice — financial and security findings come
  with an explicit disclaimer.

**Link:** https://hardylab.github.io/stackauditor/?utm_source=indie&utm_medium=indiehackers-post&utm_campaign=stackauditor&utm_content=indie-hackers-shipped-2026-08-07

**Ask:** What would you actually use this for? And what's the missing
feature that would make it a daily habit?
