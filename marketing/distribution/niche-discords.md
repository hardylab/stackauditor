# Niche Discord shortlist — StackAuditor launch

> **Owner:** CMO. **Use:** Pick 2–3 of these to post the StackAuditor launch-day intro into, staggered 3–7 days after the public launch (per [runbook.md §3](./runbook.md)).
> **Important:** Posting is done by the **board user (Hardy)**, not the CMO agent. I cannot post on behalf of anyone. The shortlist below names communities and gives the board a checklist to verify before posting — the board confirms the invite link still works, the posting rules, and recent activity before engaging.

## How I picked these

Per the [SOL-3 channel map](/SOL/issues/SOL-3), the asset's problem-space tags are: `saas`, `indie-hackers`, `bootstrap`, `solopreneur`, `consulting`, `agency`. I looked for Discord servers whose member base and posting culture match **at least two** of those tags, and that have an active `#ship`, `#feedback`, or `#introductions` channel where a one-time "I just shipped X" post would be on-topic and not spammy.

I have not verified member counts or invite-link freshness — those change weekly. The board must re-check before posting. The **activity check date** column is a placeholder for the date the board re-verifies.

## Shortlist (pick 2–3)

### 1. Indie Hackers Discord

| Field                       | Value                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| Problem-space tag match     | `indie-hackers`, `bootstrap`, `solopreneur`, `saas` (4 of 6)                                        |
| Approx. member count        | Large (>30k — verify; IH Discord has grown materially each year since 2020)                         |
| Primary audience            | Indie founders and bootstrappers shipping B2C/B2B SaaS                                              |
| Best-fit channel for post   | `#ship` or `#introductions` — one-time "I just shipped" format                                      |
| Post rules summary          | One post per product in `#ship`; no cross-promotion in `#feedback` or `#help`; links to live URL encouraged |
| Why we picked it            | Largest tag overlap of any community I know. IH Discord also feeds the IH forum, so a good post here often cross-posts to the forum organically. |
| Risks                       | High noise floor; one-time posts get scrolled in 1–2 hours. Pair the post with a value-add comment on someone else's `#ship` post in the same week. |
| Activity check date         | <TO BE FILLED BY BOARD BEFORE POSTING>                                                              |

### 2. MicroConf / Rebase community Discord

| Field                       | Value                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| Problem-space tag match     | `bootstrap`, `solopreneur`, `consulting`, `agency` (4 of 6)                                          |
| Approx. member count        | Medium (~5–10k — verify; the MicroConf community Discord grew through the Rebase rebrand)          |
| Primary audience            | SaaS bootstrappers, mostly B2B, often with 1–10 person teams                                         |
| Best-fit channel for post   | `#introductions` or `#bootstrapped` (name varies year-over-year)                                    |
| Post rules summary          | Read-the-rules channel; introductions must be tagged with founder name + product URL; self-promotion in non-introduction channels is moderated out |
| Why we picked it            | The audience density is the highest in the "bootstrap SaaS" niche. A single good post here is worth more than 10 IH impressions. |
| Risks                       | Heavily moderated. Don't pitch in `#feedback` or `#help` — it will get removed and you'll get flagged. |
| Activity check date         | <TO BE FILLED BY BOARD BEFORE POSTING>                                                              |

### 3. Small Agency / Consultancy operators Discord

| Field                       | Value                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| Problem-space tag match     | `agency`, `consulting`, `solopreneur` (3 of 6)                                                     |
| Approx. member count        | Small–medium (varies; a few thousand to ~10k depending on which server — there are 3–5 of these and the right one depends on the board's network) |
| Primary audience            | Owners of 1–10 person agencies and consultancies                                                    |
| Best-fit channel for post   | `#tools` or `#introductions`                                                                       |
| Post rules summary          | Most "agency" Discords require 90+ days of membership before posting in `#tools`; many also require a comment with personal context ("here's why I built it") |
| Why we picked it            | The agency/consultancy audience matches the [SOL-3](/SOL/issues/SOL-3) solo-consultant segment 1:1. The existing `/solo-consultant-saas-audit/` pillar is written for them. |
| Risks                       | Smaller reach than IH/MicroConf; requires longer ramp to be allowed to post. Best fit if the board already has standing in one of these communities — otherwise skip. |
| Activity check date         | <TO BE FILLED BY BOARD BEFORE POSTING>                                                              |

## Pre-post verification checklist (board runs this)

Before posting into any of the above:

- [ ] Invite link still works and the server is publicly joinable
- [ ] Current member count is within ±30% of the number above (huge drop = community is dead)
- [ ] The target channel exists and has had posts in the last 14 days
- [ ] Read the rules channel / pinned message
- [ ] Look at the last 5 posts in the target channel — what got upvoted vs. removed? Calibrate your post tone
- [ ] Draft the post **without** a link first, get feedback from a human (Hardy) on tone, then add the link with the correct UTM (`utm_source=discord&utm_medium=discord-post&utm_campaign=stackauditor&utm_content=<slug>`)
- [ ] After posting, stay in the channel for 2 hours and respond to every reply. Discords punish drive-by posters.

## UTM convention for Discord posts

```
?utm_source=discord&utm_medium=discord-post&utm_campaign=stackauditor&utm_content=<piece-slug>
```

`piece-slug` is per-channel — e.g., `discord-microconf-intro-2026-08-12`. The retro reads these by `utm_content` so per-server tagging matters.

## What this shortlist is NOT

- It is not a Reddit cross-post list (those live under [analytics.md](./analytics.md) and follow the 3-7 day stagger rule from [runbook.md §3](./runbook.md)).
- It is not a paid-ad placement list (no Discord ads — the audit-app stack has no paid acquisition line item yet).
- It is not an IH-forum post list (forum posts happen on IH via a separate mechanism — see [SOL-5](/SOL/issues/SOL-5) for that cadence).

## Open questions for board sign-off

1. **Is the board already a member of MicroConf's Discord?** If yes, post there first. If no, start with IH (#1) and one of the smaller agency Discords (#3) — IH for reach, agency Discord for fit.
2. **Should we add a fourth server?** The SaaS-specific Discords (e.g., SaaStr-adjacent, ProductHunt maker community) overlap less with the consulting/agency tag and more with the venture-funded SaaS tag, which is off-strategy for this asset per SOL-3. Default is 2-3 servers, not 5+.
3. **What is the post cadence?** SOL-5 says stagger 3–7 days after public launch. Default cadence: IH on day +3, MicroConf on day +5, agency Discord on day +7. The board can compress to 2–4 days if the launch hits hard.
