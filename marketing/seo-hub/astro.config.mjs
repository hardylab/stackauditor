import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// SEO hub for StackAuditor. Compiles /src/content/posts/*.mdx into static HTML
// at /p/<slug>/index.html. The compiled output is what GitHub Pages serves
// under hardylab.github.io/stackauditor/marketing/seo-hub/p/<slug>/.
//
// Run locally:
//   pnpm install
//   pnpm dev    # http://localhost:4321
//   pnpm build  # output -> ./dist
//
// For now (v0) the repo also commits the rendered HTML to /p/<slug>/index.html
// so GitHub Pages serves live URLs even before the Astro build is wired into
// the deploy workflow. Once the CTO adds `pnpm build` to .github/workflows/deploy.yml,
// the rendered HTML in /p/ becomes redundant and can be deleted.

export default defineConfig({
  site: 'https://hardylab.github.io/stackauditor',
  base: '/marketing/seo-hub',
  integrations: [mdx()],
  output: 'static',
  build: {
    format: 'directory',
  },
  trailingSlash: 'always',
});
