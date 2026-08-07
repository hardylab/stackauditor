# StackAuditor SEO hub

Marketing content hub for the StackAuditor asset (see [SOL-2 plan](/SOL/issues/SOL-2#document-plan)).
This is the long-form, compounding acquisition surface in the [SOL-3 channel map](/SOL/issues/SOL-3#document-plan).

## Structure

```
marketing/seo-hub/
  README.md                          <- you are here
  astro.config.mjs                   <- Astro + MDX config
  package.json                       <- local dev / build deps
  src/
    content/
      posts/                         <- MDX source for every pillar page
        saas-spend-audit.mdx
        solo-consultant-saas-audit.mdx
      templates/                     <- reusable templates per channel
        x-thread.md
        indie-post.md
        seo-pillar.md
    pages/                           <- Astro page sources (hub index)
      index.astro
    layouts/                         <- shared layouts
  p/                                 <- rendered HTML (live URLs)
    saas-spend-audit/index.html
    solo-consultant-saas-audit/index.html
  index.html                         <- rendered hub index (live URL)
```

## Dual-track shipping (why both MDX and HTML are committed)

Two paths serve the same content. Both work today:

1. **MDX source** (`src/content/posts/*.mdx`) — single source of truth, content lives in git, future-proof for when the build pipeline lands.
2. **Rendered HTML** (`p/<slug>/index.html`) — what GitHub Pages serves today, even before an Astro build is wired into the deploy workflow.

Until the CTO adds `pnpm build` to `.github/workflows/deploy.yml`, the rendered HTML in `p/` is the actual live URL. Once the build pipeline lands, the MDX becomes the source of truth and `p/` can be deleted (or kept as a cache).

## Live URLs (today, from this repo)

- Hub index: `https://hardylab.github.io/stackauditor/marketing/seo-hub/`
- Pillar 1 (SaaS spend audit): `https://hardylab.github.io/stackauditor/marketing/seo-hub/p/saas-spend-audit/`
- Pillar 2 (Solo-consultant checklist): `https://hardylab.github.io/stackauditor/marketing/seo-hub/p/solo-consultant-saas-audit/`

All of these link to the single landing page
(`https://hardylab.github.io/stackauditor/?utm_source=seo&utm_medium=...`)
per the UTM convention in `/marketing/distribution/analytics.md`.

## Run locally

```bash
cd marketing/seo-hub
pnpm install
pnpm dev      # http://localhost:4321/marketing/seo-hub/
pnpm build    # outputs to ./dist
```

## Add a new pillar

1. Drop the MDX into `src/content/posts/<slug>.mdx` with the frontmatter shape from existing posts.
2. Render the same content as static HTML into `p/<slug>/index.html` (use the existing pillar as a template for head, JSON-LD, footer).
3. Link the new pillar from at least one other post in the `related:` frontmatter.
4. Add the row to `/marketing/distribution/analytics.md` pieces inventory.
5. Commit. CI will pick up the new HTML.

## What the CMO owns

- MDX content in `src/content/posts/`
- Rendered HTML in `p/`
- Hub index in `src/pages/index.astro` + `index.html`
- All `.md` distribution drafts under `/marketing/distribution/`
- Analytics spec at `/marketing/distribution/analytics.md`
- Runbook at `/marketing/distribution/runbook.md`

## What the CTO owns

- Wiring `pnpm install` + `pnpm build` into `.github/workflows/deploy.yml`
- Plausible / Cloudflare Web Analytics snippet on `index.html` with custom-property capture for `utm_source`, `utm_medium`, `utm_content`
- Waitlist form capturing `utm_source` + `utm_content` server-side
- Backlink from the main `index.html` landing page to the SEO pillar (once the hub is live)
