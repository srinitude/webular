// Site checks on the built dist/, served by a local Bun.serve:
// every page and machine file exists; at each width no page scrolls sideways
// and the home hero command is on screen; axe finds no serious or critical
// issue; the home page stays under 100 KB gzip (CompressionStream 'gzip', HTML
// plus every same-origin script and stylesheet it loads) and loads no
// third-party script.
import { AxeBuilder } from '@axe-core/playwright'
import { BunFileSystem, BunRuntime } from '@effect/platform-bun'
import { Console, Effect, FileSystem } from 'effect'
import { type Browser, chromium, type Page } from 'playwright'

const DIST = new URL('../dist/', import.meta.url).pathname
const WIDTHS = [320, 390, 768, 1024, 1440, 2560] as const
const HEIGHT = 900
const PAGES = [
  'index',
  'install',
  'agents',
  'tools',
  'commands',
  'keys',
  'benchmarks',
  'security',
  'privacy',
  'support',
  'docs',
  '404',
] as const
const MACHINE = [
  'llms.txt',
  'llms-full.txt',
  'AGENTS.md',
  'server.json',
  'tools.json',
  '.well-known/mcp/server-card.json',
  'robots.txt',
  'sitemap.xml',
  '.well-known/security.txt',
  '_redirects',
  '_headers',
]
const WEIGHT_LIMIT = 100 * 1024

const expectedFiles = [
  ...PAGES.map((p) => `${p}.html`),
  ...PAGES.filter((p) => p !== '404').map((p) => `${p}.md`),
  ...MACHINE,
]

const fileFor = (path: string) =>
  path === '/' ? 'index.html' : path.includes('.') ? path.slice(1) : `${path.slice(1)}.html`

const server = Effect.acquireRelease(
  Effect.sync(() =>
    Bun.serve({
      port: 0,
      maxRequestBodySize: 1024,
      fetch: (req) => new Response(Bun.file(`${DIST}${fileFor(new URL(req.url).pathname)}`)),
    }),
  ),
  (s) => Effect.promise(() => s.stop(true)),
)

const browser = Effect.acquireRelease(
  Effect.tryPromise(() => chromium.launch()),
  (b) => Effect.promise(() => b.close()),
)

// axe needs a page from an explicit context, not browser.newPage().
const openPage = (b: Browser, width: number) =>
  Effect.acquireRelease(
    Effect.tryPromise(() => b.newContext({ viewport: { width, height: HEIGHT } })),
    (context) => Effect.promise(() => context.close()),
  ).pipe(Effect.flatMap((context) => Effect.tryPromise(() => context.newPage())))

const urlOf = (base: string, page: string) => (page === 'index' ? `${base}/` : `${base}/${page}`)

const scrollsSideways = (page: Page, url: string) =>
  Effect.gen(function* () {
    yield* Effect.tryPromise(() => page.goto(url))
    return yield* Effect.tryPromise(() =>
      page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    )
  })

const heroOnScreen = (page: Page, base: string, width: number) =>
  Effect.gen(function* () {
    yield* Effect.tryPromise(() => page.goto(`${base}/`))
    const hero = page.locator('#hero-command')
    const visible = yield* Effect.tryPromise(() => hero.isVisible())
    const box = yield* Effect.tryPromise(() => hero.boundingBox())
    return visible && !!box && box.y + box.height <= HEIGHT && box.x + box.width <= width
  })

const layoutAt = (b: Browser, base: string, width: number) =>
  Effect.scoped(
    Effect.gen(function* () {
      const page = yield* openPage(b, width)
      const wide = yield* Effect.forEach(
        PAGES,
        (name) => scrollsSideways(page, urlOf(base, name)),
        {
          concurrency: 1,
        },
      )
      const failures = PAGES.filter((_, i) => wide[i]).map(
        (n) => `${n} scrolls sideways at ${width}px`,
      )
      const hero = yield* heroOnScreen(page, base, width)
      return hero ? failures : [...failures, `hero command not on screen at ${width}px`]
    }),
  )

const axeOne = (page: Page, base: string, name: string) =>
  Effect.gen(function* () {
    yield* Effect.tryPromise(() => page.goto(urlOf(base, name)))
    const { violations } = yield* Effect.tryPromise(() => new AxeBuilder({ page }).analyze())
    return violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `axe ${name}: ${v.impact} ${v.id} ${v.help} (${v.nodes.length} nodes)`)
  })

const axeAll = (b: Browser, base: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const page = yield* openPage(b, 390)
      const found = yield* Effect.forEach(PAGES, (name) => axeOne(page, base, name), {
        concurrency: 1,
      })
      return found.flat()
    }),
  )

const gzipSize = (bytes: Uint8Array) =>
  Effect.tryPromise(() =>
    new Response(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),
    ).arrayBuffer(),
  ).pipe(Effect.map((buf) => buf.byteLength))

const weight = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const html = yield* fs.readFileString(`${DIST}index.html`)
  const refs = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map(
    (m) => m[1] ?? '',
  )
  const thirdParty = [...html.matchAll(/<script[^>]*src="(?:https?:)?\/\/[^"]+"/g)].length
  const local = refs.filter((r) => r.startsWith('/') && /\.(js|css)$/.test(r))
  const bodies = yield* Effect.forEach(local, (r) => fs.readFile(`${DIST}${r.slice(1)}`), {
    concurrency: 4,
  })
  const sizes = yield* Effect.forEach([new TextEncoder().encode(html), ...bodies], gzipSize, {
    concurrency: 4,
  })
  const bytes = sizes.reduce((sum, n) => sum + n, 0)
  yield* Console.log(
    `home weight: ${bytes} bytes gzip over ${sizes.length} files (limit ${WEIGHT_LIMIT})`,
  )
  const failures = thirdParty > 0 ? [`home loads ${thirdParty} third-party scripts`] : []
  return bytes < WEIGHT_LIMIT ? failures : [...failures, `home is ${bytes} bytes gzip`]
})

const missing = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const present = yield* Effect.forEach(expectedFiles, (f) => fs.exists(`${DIST}${f}`), {
    concurrency: 8,
  })
  yield* Console.log(`files: ${present.filter(Boolean).length}/${expectedFiles.length} present`)
  return expectedFiles.filter((_, i) => !present[i]).map((f) => `missing dist/${f}`)
})

const program = Effect.gen(function* () {
  const files = yield* missing
  const s = yield* server
  const base = `http://localhost:${s.port}`
  const b = yield* browser
  const layout = yield* Effect.forEach(WIDTHS, (w) => layoutAt(b, base, w), { concurrency: 1 })
  yield* Console.log(`layout: ${PAGES.length} pages at ${WIDTHS.join(', ')}px`)
  const axe = yield* axeAll(b, base)
  yield* Console.log(`axe: ${PAGES.length} pages checked`)
  const failures = [...files, ...layout.flat(), ...axe, ...(yield* weight)]
  if (failures.length > 0) return yield* Effect.fail(new Error(failures.join('\n')))
  yield* Console.log('site:test ok')
})

program.pipe(
  Effect.scoped,
  Effect.tapError((e) => Console.error(`site:test failed:\n${String(e)}`)),
  Effect.provide(BunFileSystem.layer),
  BunRuntime.runMain,
)
