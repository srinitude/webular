// Shared pieces of the site checks: the dist/ folder, the page list from
// astro.config.ts, a local Bun.serve over dist/, and one Chromium.
import { Effect } from 'effect'
import { type Browser, chromium } from 'playwright'
import { SLUGS } from '../astro.config.ts'

export const DIST = new URL('../dist/', import.meta.url).pathname
export const PAGES = SLUGS
export const HEIGHT = 900
export const WIDTHS = [
  320, 360, 375, 390, 414, 430, 600, 768, 820, 1024, 1280, 1440, 1920, 2560,
] as const
export type Theme = 'light' | 'dark'

const fileFor = (path: string) =>
  path === '/' ? 'index.html' : path.includes('.') ? path.slice(1) : `${path.slice(1)}.html`

export const server = Effect.acquireRelease(
  Effect.sync(() =>
    Bun.serve({
      port: 0,
      maxRequestBodySize: 1024,
      fetch: (req) => new Response(Bun.file(`${DIST}${fileFor(new URL(req.url).pathname)}`)),
    }),
  ),
  (s) => Effect.promise(() => s.stop(true)),
)

export const browser = Effect.acquireRelease(
  Effect.tryPromise(() => chromium.launch()),
  (b) => Effect.promise(() => b.close()),
)

// axe needs a page from an explicit context, not browser.newPage(). The site
// themes by prefers-color-scheme only, so colorScheme picks the theme.
export const openPage = (b: Browser, width: number, theme: Theme) =>
  Effect.acquireRelease(
    Effect.tryPromise(() =>
      b.newContext({ viewport: { width, height: HEIGHT }, colorScheme: theme }),
    ),
    (context) => Effect.promise(() => context.close()),
  ).pipe(Effect.flatMap((context) => Effect.tryPromise(() => context.newPage())))

export const urlOf = (base: string, page: string) =>
  page === 'index' ? `${base}/` : `${base}/${page}`
