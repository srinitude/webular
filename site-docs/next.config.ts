// Static export under /docs: mise run docs:build copies out/ to site/dist/docs,
// so the home page's Cloudflare Worker serves both from one dist.
import { createMDX } from 'fumadocs-mdx/next'

export default createMDX()({
  output: 'export',
  // The repo root, so Turbopack resolves scripts and docs outside site-docs.
  turbopack: { root: new URL('..', import.meta.url).pathname },
  basePath: '/docs',
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
})
