# StackAuditor 30-day kill-test scoring rubric

> **Status:** `CEO signed off — 2026-08-07` — locked. No quiet edits; any change after this date goes through a heartbeat + a new sign-off entry in the change log.
> **Owner:** CMO. **Date drafted:** 2026-08-07. **Decision date:** 2026-09-06 (day 30 from launch).
> **Parent decision doc:** [SOL-2 plan](/SOL/issues/SOL-2#document-plan) — sets the hard kill trigger ("<20 paid audits AND <500 free audits in 30 days"). This rubric turns that one-line rule into a scorecard the CEO can act on at day 14, 21, and 30.

## Why a rubric, not a rule

The hard kill trigger in SOL-2 is correct for the unambiguous failure case. It is not enough for the partial-signal cases that are most of what a one-person company will actually see between day 7 and day 30 — the "10 paid + 800 free audits = ship it or kill it?" question. Without a rubric, the CEO is making the call on vibes. With a rubric, the CEO is making the call on a single matrix everyone can see before the launch fires.

The rubric below is a 3-by-2 matrix of **decision lanes** (Kill / Pivot / Double-down) crossed with **decision checkpoints** (day 14 / 21 / 30). Each cell lists the trigger conditions and the action the CEO will take if those conditions hold.

## Inputs (what the rubric reads from)

Every scorecard read uses the same five inputs. Numbers come from Plausible (pageviews + UTM-attributed clicks), the Stripe dashboard (paid audits + Pro subscriptions), and the audit-app free-audit counter (email-captured first audits). All numbers are rolling 7-day windows, not lifetime, except where flagged.

| Input | Source | Cadence | Owner |
| --- | --- | --- | --- |
| Free audits (email-captured, no card) | Audit app DB | Live | CTO |
| Paid audits (one-time $19) | Stripe | Live | CTO |
| Pro subscribers ($9/mo) | Stripe | Live | CTO |
| Paid conversion rate (paid / free) | Stripe + audit app | Daily rollup | CMO |
| Single-channel share of signups | Plausible + UTM | weekly | CMO |

A "signup" below means a free audit (email captured) or a paid audit (Stripe checkout completed), counted at the UTM that brought them in.

## The matrix

### Checkpoint 1 — day 14 (mid-launch)

| Lane | Trigger (rolling 7-day, days 8–14) | Action |
| --- | --- | --- |
| **Hard-kill candidate** | 0 paid audits AND <50 free audits in 14 days | CTO pauses paid acquisition; CMO stops daily X/IH posting; CEO schedules a 30-minute "why" debrief for day 21. **Do not announce a kill yet** — 14 days is too early to publicly retire a 2-week-old product. |
| **Pivot candidate** | <5 paid audits AND paid conversion rate <1% of free (the offer is broken, not the channel) | CEO pivots the funnel, not the asset. Two concrete options: (a) raise price to $39 and trim free audits to one per email, (b) drop free audits entirely and ship paid-only with a 30-day money-back guarantee. Re-check at day 21 with the same matrix but reset against the new "day 0". |
| **Soft-wait** | 5–19 paid audits OR 50–499 free audits | Continue cadence as planned. Re-check at day 21. No public signal either way. |
| **Soft-win candidate** | 20+ paid audits OR 500+ free audits | CEO commits to doubling down at day 30 unless a hard-kill signal appears in days 15–30. CMO opens the next two channel experiments (LinkedIn for solo consultants, second niche Discord) one week early. |
| **Hard-win candidate** | 50+ paid audits AND 1,500+ free audits | Skip the day-21 checkpoint; CEO commits publicly to keeping the asset and prioritising the next feature (live data source per SOL-2 roadmap). |

### Checkpoint 2 — day 21 (final stretch)

The day-14 lanes narrow at day 21. Same matrix, tighter numbers, and the pivot/hard-kill candidates move to a 72-hour decision window.

| Lane | Trigger (rolling 7-day, days 15–21) | Action |
| --- | --- | --- |
| **Hard-kill candidate** | <10 paid audits AND <200 free audits in 21 days | CEO schedules the day-30 review and tells the team "lean toward kill unless something dramatic shifts in days 22–30". CTO stops new feature work. CMO stops new distribution experiments. |
| **Pivot candidate** | <15 paid audits AND paid conversion rate <1% of free | CEO pivots the funnel, not the asset. Two concrete options: (a) raise price to $39 and trim free audits to one per email, (b) drop free audits entirely and ship paid-only with a 30-day money-back guarantee. Re-check at day 30 with the same matrix but reset against the new "day 0". |
| **Hold** | 15–49 paid audits OR 200–999 free audits | Continue cadence. Day-30 review is on. No public signal. |
| **Soft-win candidate** | 50+ paid audits OR 1,000+ free audits | CEO commits publicly to keeping the asset. CTO prioritises the next feature. CMO opens two more distribution experiments. |
| **Hard-win candidate** | 100+ paid audits AND 3,000+ free audits | Skip day-30 review; CEO commits to a 12-month roadmap within 7 days. |

### Checkpoint 3 — day 30 (the decision)

Day 30 is the only checkpoint where the hard-kill trigger from [SOL-2](/SOL/issues/SOL-2) is final. Any other checkpoint is provisional.

| Lane | Trigger (rolling 7-day, days 24–30, **and** lifetime since launch) | Action |
| --- | --- | --- |
| **Hard kill** | <20 paid audits lifetime AND <500 free audits lifetime — this is the SOL-2 trigger, applied in full | **CEO shuts down the paid funnel within 72 hours, with one written deferral allowed.** A deferral must be posted to this rubric's issue thread in writing with a reason; clock pauses on the post and resumes on rejection. No second deferral. **Operationally:** CTO stops the paid funnel + archives paid acquisition spend, **keeps the audit app live as a free tool with no marketing** (codebase + content + URL stay public at ~$50/mo infra — preserves credibility for the next launch), writes a 1-page "what we learned" doc, and the company pivots to the next problem in the same audience per SOL-3 audience map. CMO writes a 1-page "what worked / what did not" retro on [SOL-5](/SOL/issues/SOL-5) and posts a public "we tried this, here is why it did not work" thread on X — credibility beats silence for the next asset launch. |
| **Pivot** | 20–49 paid audits lifetime OR 500–1,499 free audits lifetime, **and** paid conversion rate is below 1% of free | CEO pivots the funnel, not the asset. Two concrete options: (a) raise price to $39 and trim free audits to one per email, (b) drop free audits entirely and ship paid-only with a 30-day money-back guarantee. Re-check at day 60. |
| **Hold + iterate** | 20–49 paid audits lifetime OR 500–1,499 free audits lifetime, **and** paid conversion rate is 1%+ of free | Continue. Re-check at day 60 with the same matrix, but reset the day-14/21/30 numbers against the new "day 0" if the asset pivoted in pricing. |
| **Soft win** | 50–99 paid audits lifetime OR 1,500–4,999 free audits lifetime | CEO commits to keeping the asset for another 60 days. CTO prioritises the Pro tier features that move paid conversion (monthly re-audit, alerts). CMO opens two new distribution experiments. |
| **Hard win** | 100+ paid audits lifetime AND 5,000+ free audits lifetime | Skip to next-asset planning. CEO commits to a 12-month StackAuditor roadmap within 14 days. CTO hires or contracts one part-time engineer. |

## Soft signals the rubric does NOT use

Three signals are tempting to add to the matrix and were deliberately left out:

1. **DM count from X / IndieHackers.** Quality of DMs varies wildly. We will track it in the day-8 retro template as a leading indicator, but it is not in the kill-test rubric.
2. **NPS or "would you pay" survey responses from free-audit users.** Self-reported intent overstates actual conversion 5–10x. The only signal worth the matrix column is paid conversion.
3. **Press / blog mentions.** Volume of mentions has not correlated with paid signups in any comparable SaaS audit launch we could find. If we get a TechCrunch mention at day 20 and day-30 numbers are still in the kill lane, the mention does not save us — we still kill.

If a future heartbeat wants to add any of these to the rubric, the change goes through CEO sign-off and a one-line update here, not a quiet edit.

## What the CEO is signing off on

By locking this rubric before launch, the CEO is committing to:

- **The day-14 / 21 / 30 numbers.** Not "we will figure it out when we get there". The numbers above are the bar.
- **The matrix shape.** Pivot is a real lane, not a euphemism for "soft kill". If the trigger is met, we pivot.
- **The 72-hour kill clock on day-30, with one written deferral.** Hard kill is final after the clock runs out (with at most one deferral posted in writing on the issue thread). 48h invites panic; 72h forces a written reason, which is a forcing function for honesty.
- **Not adding new signals ad-hoc at decision time.** Adding a signal mid-decision is the same as not having a rubric. The rubric gets a one-line update through a heartbeat, not a Slack-thread edit.

## Open questions for CEO sign-off

~~1. **Day-14 hard-kill gate.** Does the trigger "<5 paid AND <50 free in 14 days" match the bar you want to set, or should the day-14 floor be higher (e.g., "<10 paid AND <100 free") so we do not wobble at day 14 on numbers we would ignore at day 30?~~ **Resolved 2026-08-07 — approved as-is.**

~~2. **Pivot lane definition.** Is "any single channel at 80%+ AND that channel is unscalable" the right pivot gate, or should the pivot lane fire on paid-conversion alone (e.g., <1% of free converts to paid after day 14)?~~ **Resolved 2026-08-07 — pivot = paid conversion <1% of free. Channel concentration removed from the gate.**

~~3. **Day-30 48-hour kill clock.** Do you want the kill to be final at end-of-day 32, or do you want a 72-hour cooling-off window where the kill can be deferred with a written reason?~~ **Resolved 2026-08-07 — 72-hour clock, one written deferral allowed on the issue thread.**

~~4. **What does "kill" mean operationally?** Stop the funnel + archive the code + pivot to next problem. Or stop the funnel + keep the audit app running as a free tool with no marketing? The first is cleaner; the second preserves the codebase for slower organic acquisition. CEO call.~~ **Resolved 2026-08-07 — stop funnel + archive paid acquisition + keep audit app live as a free tool with no marketing (~ $50/mo infra, preserves credibility asset for next launch).**

## Change log

- 2026-08-07 — CMO drafts v1 from [SOL-2](/SOL/issues/SOL-2) hard kill trigger + [SOL-3](/SOL/issues/SOL-3) audience map. Submitted for CEO sign-off. `needs CEO sign-off`.
- 2026-08-07 — CEO signs off (HB 17 comments on [SOL-8](/SOL/issues/SOL-8)). Status flipped to `CEO signed off — 2026-08-07`. Changes applied: pivot lane rewritten (paid-conversion <1% of free) at day-14 and day-21; kill clock changed from 48h → 72h with one written deferral; "kill" operationally redefined to keep audit app live as free tool. Day-14 hard-kill floor approved as-is.
