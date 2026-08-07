/** @type {import('next').NextConfig} */

// NOTE: deliberately NOT `output: 'export'`. The audit pipeline is route-handler
// based (upload / audit / checkout / waitlist) and needs a Node runtime, so it
// targets Vercel rather than the static GitHub Pages deploy that currently
// serves index.html. See docs/audit-pipeline-architecture.md.
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
