# Distribution runbook (CMO)

How to ship a distribution piece for a digital asset, end to end. Use this for
every new piece under `/marketing/distribution/`.

## 0. Pre-flight checklist

Before posting anything externally:

- [ ] Asset decision doc exists ([SOL-2 plan](/SOL/issues/SOL-2#document-plan)).
- [ ] Asset landing page is live with analytics snippet (CTO owns — confirm via
      `curl -s https://hardylab.github.io/stackauditor/ | grep plausible`).
      Plausible domain registered: `hardylab.github.io`.
      Plausible dashboard: https://plausible.io/hardylab.github.io (login required).
      Goal to watch: `waitlist_submission` (Settings → Goals → Custom event).
- [ ] UTM convention understood ([analytics.md](./analytics.md)).
- [ ] The piece is filed under the right channel folder:
      - `x-threads/<slug>.md`
      - `indie-posts/<slug>.md`
      - `seo-posts/<slug>.mdx` (lives in `/marketing/seo-hub/src/content/posts/`,
        built by Astro)

## 1. Draft the piece

Pick the right template from
[/marketing/seo-hub/src/content/templates/](/marketing/seo-hub/src/content/templates/).
Fill in `<ASSET_*>` placeholders from the asset decision doc. Always include
the two "honest limitations" — audiences reward honesty and it pre-empts the
worst kinds of comments.

Frontmatter every piece with:

```yaml
---
channel: x | indie | seo
piece_slug: <stable-id>
utm_content: <matches the link in the body>
target_url: https://hardylab.github.io/stackauditor/?utm_source=<channel>&utm_medium=<surface>&utm_campaign=stackauditor&utm_content=<piece-slug>
status: draft | scheduled | published | archived
live_url: <filled in after posting>
posted_at: <ISO timestamp>
---
```

## 2. Sanity-check the link

The `target_url` must:

- Include all four UTM params.
- Point at the **single landing page**, never at the SEO hub or any other
  surface. All attribution flows through one page.
- Be lowercase, hyphen-separated, no query-param reordering.

If the link breaks, the entire retro is corrupted. Verify with:

```bash
echo "<target_url>" | grep -E "utm_source=(x|indie|seo|direct|email)&utm_medium=[a-z-]+&utm_campaign=stackauditor&utm_content=[a-z0-9-]+"
```

## 3. Publish

Per channel:

- **X:** tweet-by-tweet from the founder account. Numbered `.md` files map 1:1
  to tweets. Archive the live thread URL into the file's frontmatter `live_url`.
- **IndieHackers:** one post per launch. Tags: `indie`, `ship`, problem-space
  tag. Archive the post URL in frontmatter.
- **Show HN:** one comment = the post body. Lead with the limitation. Archive
  the URL.
- **Reddit (r/SideProject, r/IndieHackers, r/SaaS):** cross-post the IH body
  **staggered 3-7 days after** the initial launch, never on launch day. Reddit
  punishes launch-day cross-posts.
- **SEO pillar:** commit the MDX under
  `/marketing/seo-hub/src/content/posts/<slug>.mdx`. CTO pipeline compiles to
  static HTML and deploys. Verify index in Search Console within 7 days.

## 4. Track

Open [analytics.md](./analytics.md) and add a row to the "Pieces inventory"
table. This is what the retro reads.

Plausible dashboard (login required):
- Site: https://plausible.io/hardylab.github.io
- Goal: `waitlist_submission` (custom event, fired from the landing-page form).
- For the first 7 days, check daily:
  - Plausible → break down `utm_content` → unique visitors + waitlist goal.
  - X → thread impressions + link clicks.
  - IH / HN / r/* → upvotes, comments, click-throughs.

After 7 days, switch to weekly checks.

## 5. Retro

When the asset has shipped its 3 launch pieces and 7 days have passed, post a
one-page retro on the issue:

```
# <ASSET_NAME> launch retro

- Pieces shipped: <links + UTMs>
- 7-day numbers: impressions, CTR, signups per piece
- What worked: <1-2 bullets>
- What did not: <1-2 bullets>
- Next 4 experiments: <what to double down on, what to cut>
```

This retro is the input to the next distribution cycle and the proof that the
3-channel base map on [SOL-3](/SOL/issues/SOL-3) is right (or wrong).

## 6. Coordination with CTO

CMO does **not** own the deploy pipeline. Anything that needs a build step
(Astro, MDX, sitemap) is the CTO's call:

- CMO writes `.mdx` source + `.html` preview in
  `/marketing/seo-hub/src/content/posts/` and `/marketing/seo-hub/p/`.
- CTO wires the Astro build (or equivalent) into the deploy workflow.
- Until that lands, the SEO pillar ships as the static HTML preview so URLs
  are live from day one.

The CMO never merges to `main` without an updated deploy workflow. The
exception is the v0 ship, where static HTML is committed alongside the MDX
source so both paths are valid.
