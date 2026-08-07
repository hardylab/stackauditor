# StackAuditor day-8 launch retro template

> **Use:** Fill in on day 8 of the StackAuditor launch (i.e., the day the first 7-day metrics window closes). Post the filled-in version on [SOL-5](/SOL/issues/SOL-5) as a comment.
> **Owner:** CMO. **Window:** rolling 7 days from public launch (target launch date 2026-08-07 → retro on 2026-08-15).
> **Inputs:** Plausible (`hardylab.github.io`), Stripe dashboard, audit-app email-capture counter.

## 1. Headline

**One-sentence read.** "Day 8: <kill | hold | soft-win | soft-kill> — <single-line reason>." This is the only thing the CEO will read first.

## 2. Per-channel metrics

All numbers are rolling 7-day totals (launch day 0 through day 7 inclusive). Tag every row with the same UTM convention from [analytics.md](./analytics.md). If a number is zero, write `0` — don't leave blanks.

| Channel           | Piece                                    | `utm_content`                  | Impressions / Reach | Clicks / CTR | Waitlist / Audit signups | Notes |
| ----------------- | ---------------------------------------- | ------------------------------ | ------------------- | ------------ | ------------------------ | ----- |
| X                 | Launch thread                            | `launch-thread-2026-08-07`     |                     |              |                          |       |
| X                 | Day-3 follow-up thread (if shipped)       | `<slug>`                       |                     |              |                          |       |
| IndieHackers      | "Shipped" post                           | `indie-hackers-shipped-2026-08-07` |                  |              |                          |       |
| Show HN           | Show HN post                             | `show-hn-2026-08-07`           |                     |              |                          |       |
| Reddit (r/SideProject, day +3 to +7) | Cross-post                | `r-sideproject-2026-08-07`     |                     |              |                          |       |
| Reddit (r/SaaS, day +3 to +7)        | Cross-post                | `r-saas-2026-08-07`            |                     |              |                          |       |
| Reddit (r/IndieHackers, day +3 to +7) | Cross-post               | `r-indiehackers-2026-08-07`    |                     |              |                          |       |
| LinkedIn (solo consultants niche) | Founding-story post              | `<slug>`                       |                     |              |                          |       |
| Niche Discord #1  | Per [Discord shortlist](./niche-discords.md) | `<slug>`                  |                     |              |                          |       |
| Niche Discord #2  | Per shortlist                            | `<slug>`                       |                     |              |                          |       |
| SEO — pillar 1    | SaaS spend audit                         | `saas-spend-audit`             | (Search Console)    |              |                          |       |
| SEO — pillar 2    | Solo-consultant checklist                | `solo-consultant-saas-audit`   | (Search Console)    |              |                          |       |
| SEO — pillar 3    | Hidden SaaS costs                        | `hidden-saas-costs`            | (Search Console)    |              |                          |       |
| SEO — pillar 4    | SaaS subscription creep                  | `saas-subscription-creep`      | (Search Console)    |              |                          |       |
| Email             | Waitlist welcome / day-3 nudge (if any)  | `email-day-0`                  |                     |              |                          |       |

**Totals row** at the bottom — sum impressions, clicks, signups across all channels. This is the single number that goes into the headline.

## 3. UTM attribution summary

Copy the table from Plausible → "Goal `waitlist_submission` → Breakdown by `utm_content`" and paste it below verbatim. Format:

| `utm_content`            | Waitlist signups (7d) | % of total |
| ------------------------ | --------------------- | ---------- |
| `launch-thread-...`      |                       |            |
| `indie-hackers-shipped-...` |                    |            |
| ...                      |                       |            |
| **Total**                |                       | 100%       |

If a piece has 0 signups after 7 days, leave the row in — do not delete it. Zero rows are signal.

## 4. Conversion funnel

| Stage                                      | Count | Conversion vs prior stage |
| ------------------------------------------ | ----- | ------------------------- |
| Landing-page unique visitors (7d)          |       | —                         |
| Scrolled past hero (Plausible scroll depth ≥ 50%) |  |   |
| Clicked "Run free audit" CTA               |       |                           |
| Uploaded a screenshot (started audit)      |       |                           |
| Completed audit + email captured (free)    |       |                           |
| Paid audit (`$19`)                         |       |                           |
| Pro subscriber (`$9/mo`)                   |       |                           |

Paid conversion rate = paid audits / free audits completed. This is the single most important number in the whole retro.

## 5. What worked

1. <Specific thing that beat expectation. Cite the channel + UTM. Quantify.>
2. <Second winning thing.>
3. <Third, if there is one.>

## 6. What did not

1. <Specific thing that underperformed. Cite the channel + UTM. Quantify.>
2. <Second underperformer.>
3. <Third.>

## 7. Kill-test rubric read

Score against the 30-day rubric at [kill-test-rubric.md](./kill-test-rubric.md):

- **Day 8 (informal only):** No kill action yet — too early.
- **Day 14 projected:** <which lane from the day-14 matrix we are tracking toward>
- **Day 21 projected:** <which lane>
- **Day 30 projected:** <which lane>
- **Hard-kill trigger?:** No (day 8 is too early) — but flag any single-channel share ≥ 80% of signups as a pivot warning.

## 8. Next 4 experiments (days 8–14)

Two double-downs (channels that worked, run a second piece) and two cuts (channels that did not, do not repeat). Each gets a one-line hypothesis and a success metric.

| # | Type        | Channel / piece                                | Hypothesis                                                                                              | Success metric                                  |
| - | ----------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1 | Double-down |                                                |                                                                                                         |                                                 |
| 2 | Double-down |                                                |                                                                                                         |                                                 |
| 3 | Cut         |                                                |                                                                                                         |                                                 |
| 4 | Cut         |                                                |                                                                                                         |                                                 |

## 9. Open questions for CEO

Numbered list of decisions the CEO needs to make before day 14. Each question is one line; the answer reshapes days 8–14.

1. <Question>
2. <Question>

## 10. Single CTA in the comment

End the SOL-5 comment with: "Score against [kill-test-rubric.md](./kill-test-rubric.md) day-14 trigger at day 14 — recommend the CEO reads the day-14 numbers on [YYYY-MM-DD]."

## Related

- [SOL-3 channel map](/SOL/issues/SOL-3)
- [SOL-5 distribution plan](/SOL/issues/SOL-5)
- [analytics.md](./analytics.md)
- [kill-test-rubric.md](./kill-test-rubric.md)
- [runbook.md](./runbook.md)
