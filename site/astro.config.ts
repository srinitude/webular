// Static build: no adapter (Cloudflare Workers static assets serve dist/).
// build.format 'file' writes /install.html next to its /install.md twin.
// Routes live in src/routes, not src/pages: Astro renders every .md in
// src/pages as a page, which would publish that folder's AGENTS.md and
// CLAUDE.md (and AGENTS.md overwrites agents.html on a case-blind disk).
import { defineConfig } from 'astro/config'

// Every page slug, in /llms.txt order after index; scripts/ imports this list.
export const SLUGS = [
  'index',
  'install',
  'keys',
  'security',
  'agents',
  'tools',
  'commands',
  'benchmarks',
  'privacy',
  'support',
  'docs',
  '404',
] as const

type InjectRoute = (route: { pattern: string; entrypoint: URL }) => void

const routes = {
  name: 'webular-routes',
  hooks: {
    'astro:config:setup': ({ injectRoute }: { injectRoute: InjectRoute }) => {
      for (const slug of SLUGS)
        injectRoute({
          pattern: slug === 'index' ? '/' : `/${slug}`,
          entrypoint: new URL(`./src/routes/${slug}.astro`, import.meta.url),
        })
    },
  },
}

export default defineConfig({
  site: 'https://webular.dev',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'always' },
  integrations: [routes],
  // The CSP allows only same-origin scripts, so the page script ships as a file.
  vite: { build: { assetsInlineLimit: 0 } },
})
