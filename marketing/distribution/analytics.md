# Analytics tracking spec (StackAuditor launch)

One source of truth for how every distribution piece attributes to the asset. All
three channels (X, indie communities, owned SEO site) point to the **same landing
page** with different UTMs. No channel-specific landing pages.

## Landing page (single attribution surface)

`https://hardylab.github.io/stackauditor/`

Owned by CTO under [SOL-4](/SOL/issues/SOL-4). Every distribution link points
here. The landing page is the only place we instrument — no per-channel landing
pages for v1.

## UTM convention

```
?utm_source=<channel>&utm_medium=<surface>&utm_campaign=<asset-slug>&utm_content=<piece-slug>
```

| Param            | Allowed values                                                   |
| ---------------- | ---------------------------------------------------------------- |
| `utm_source`     | `x`, `indie`, `seo`, `direct`, `email`                           |
| `utm_medium`     | `x-thread`, `show-hn`, `indiehackers-post`, `r-sideproject`, `pillar-page`, `related-post`, `newsletter` |
| `utm_campaign`   | `stackauditor` (per asset)                                       |
| `utm_content`    | Stable slug of the piece (e.g. `launch-thread-2026-08-07`, `saas-spend-audit`) |

Strict lowercase, hyphen-separated. Every CMO-authored link goes through this
convention — no exceptions, no naked URLs in published posts.

## Single landing page attribution

All three channels push traffic to **one URL**:

- The landing page reads `utm_*` query params and forwards them to Plausible
  custom properties (CTO will add this snippet to `index.html`).
- All clicks from any of the 3 channels show up under the same `/?waitlist`
  goal, segmented by `utm_source` in Plausible.
- If a user submits the waitlist form, we capture `utm_source` + `utm_content`
  server-side so the retro can say "X thread drove 12 waitlist signups,
  Show HN drove 4" without needing a separate attribution tool.

## Per-channel instrumentation

| Channel | Metric we own                       | How we measure                                | Cadence            |
| ------- | ----------------------------------- | --------------------------------------------- | ------------------ |
| X       | impressions, clicks, DMs            | X analytics + UTM clicks on `/?utm_source=x`  | Daily 7d, then wk  |
| Indie   | upvotes, comments, click-throughs   | Platform-native + UTM clicks                  | Daily 7d           |
| SEO     | impressions, CTR, ranking, signups  | Google Search Console + Plausible              | Weekly             |

**Daily 7d** means we check every day for the first 7 days after launch, then
weekly after that. The first 7 days are when launch momentum actually converts
into followers or signups.

## Pieces inventory (this launch)

| Piece                                       | Channel | `utm_content`                  |
| ------------------------------------------- | ------- | ------------------------------ |
| X launch thread                             | X       | `launch-thread-2026-08-07`     |
| IndieHackers "Shipped" post                 | IH      | `indie-hackers-shipped-2026-08-07` |
| Show HN-style post                          | HN      | `show-hn-2026-08-07`           |
| r/SideProject cross-post (3-7d later)       | Reddit  | `r-sideproject-2026-08-07`     |
| SEO pillar: SaaS spend audit                | SEO     | `saas-spend-audit`             |
| SEO related post: solo-consultant stack     | SEO     | `solo-consultant-saas-audit`   |
| SEO pillar: Hidden SaaS costs (10-min triage) | SEO   | `hidden-saas-costs`            |
| SEO pillar: SaaS subscription creep         | SEO     | `saas-subscription-creep`      |

All of these live as files under `/marketing/distribution/`. The CMO retro
re-reads this table, plugs in 7-day numbers, and posts on [SOL-5](/SOL/issues/SOL-5).

## Coordination note for CTO

To make this fire, [SOL-4](/SOL/issues/SOL-4) needs:

1. Plausible (or Cloudflare Web Analytics) snippet on `index.html` with
   custom-property capture for `utm_source`, `utm_medium`, `utm_content`.
2. Waitlist form captures `utm_source` + `utm_content` on submit and writes
   them to the `waitlist` table.
3. A Plausible goal named `waitlist_submission` fired on form submit.

When wired, the CMO retro is a single Plausible breakdown — no extra plumbing.
