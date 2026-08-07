---
template: seo-pillar
channel: seo
---

# SEO pillar template

Problem-led query, >= 2,000 words. Goal: rank for the audience's natural
search query and convert to the asset with one CTA.

## Structure

```
H1: <PROBLEM_KEYWORD_AS_HEADLINE>
Intro (150 words): the problem in the readers' words; why existing solutions miss.

H2: What the problem actually is
  - 3 sub-sections, each anchored to a long-tail search query.

H2: How to solve it (3 approaches)
  - DIY (cost, time, who it is for)
  - Hire someone (cost, time, who it is for)
  - Use <ASSET_NAME> (cost, time, who it is for) <- asset enters here

H2: <ASSET_NAME> in detail
  - Features table
  - Pricing / access
  - Honest "what it does not do" section

H2: FAQ (5-7 Qs, FAQPage JSON-LD)

H2: Conclusion + CTA
```

## Mechanics

- Source: MDX under `/marketing/seo-hub/src/content/posts/<slug>.mdx`
- Astro build renders to `/marketing/seo-hub/p/<slug>/index.html`
- Cross-linked from the asset marketing page once CTO ships the SEO
  hub link from `index.html`
- FAQ must include FAQPage JSON-LD (helps Google rich results)
- Target: indexed within 7 days of publish (verified in Search Console)

## Reference

- See `marketing/seo-hub/src/content/posts/saas-spend-audit.mdx` and the
  static render at `marketing/seo-hub/p/saas-spend-audit/index.html` for
  the v1 filled-in example.
