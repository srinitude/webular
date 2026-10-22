// Site checks on the built dist/, served by a local Bun.serve: every page and
// machine file exists; at each width in WIDTHS, the probes in width-checks.ts
// pass (no sideways scroll, 44px targets, focus ring, hero command, axe in
// both themes); the home page stays under 100 KB gzip (CompressionStream
// 'gzip', HTML plus every same-origin script and stylesheet it loads) and
// loads no third-party script. Prints pass and fail counts per check per width.
import { BunFileSystem, BunRuntime } from '@effect/platform-bun'
import { Console, Effect, FileSystem } from 'effect'
import type { Browser } from 'playwright'
import { browser, DIST, PAGES, server, WIDTHS } from './site-browser.ts'
import { CHECKS, checkWidth } from './width-checks.ts'

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
// The agents page twin is served at /agents/index.md.
const twinOf = (p: string) => (p === 'agents' ? 'agents/index.md' : `${p}.md`)

const expectedFiles = [
  ...PAGES.map((p) => `${p}.html`),
  ...PAGES.filter((p) => p !== '404').map(twinOf),
  ...MACHINE,
]

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
  const ok = bytes < WEIGHT_LIMIT
  yield* Console.log(
    `home weight: ${bytes} bytes gzip over ${sizes.length} files (limit ${WEIGHT_LIMIT}): ${ok ? 'pass' : 'fail'}`,
  )
  const failures = thirdParty > 0 ? [`home loads ${thirdParty} third-party scripts`] : []
  return ok ? failures : [...failures, `home is ${bytes} bytes gzip`]
})

const missing = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const present = yield* Effect.forEach(expectedFiles, (f) => fs.exists(`${DIST}${f}`), {
    concurrency: 8,
  })
  yield* Console.log(`files: ${present.filter(Boolean).length}/${expectedFiles.length} present`)
  return expectedFiles.filter((_, i) => !present[i]).map((f) => `missing dist/${f}`)
})

// One width: print "<check> pass/total" for every check, return its failures.
const reportWidth = (b: Browser, base: string, width: number) =>
  Effect.gen(function* () {
    const tally = yield* checkWidth(b, base, width)
    const rows = CHECKS.map((c) => [c, tally.get(c) ?? { pass: 0, fail: 0, failures: [] }] as const)
    const counts = rows.map(([c, t]) => `${c} ${t.pass} pass ${t.fail} fail`)
    yield* Console.log(`${width}px: ${counts.join(' | ')}`)
    return rows.flatMap(([, t]) => t.failures)
  })

const program = Effect.gen(function* () {
  const files = yield* missing
  const s = yield* server
  const b = yield* browser
  const base = `http://localhost:${s.port}`
  const widths = yield* Effect.forEach(WIDTHS, (w) => reportWidth(b, base, w), {
    concurrency: 4,
  })
  const failures = [...files, ...widths.flat(), ...(yield* weight)]
  yield* Console.log(`${WIDTHS.length} widths checked; ${failures.length} failures`)
  if (failures.length > 0) return yield* Effect.fail(new Error(failures.join('\n')))
  yield* Console.log('site:test ok')
})

program.pipe(
  Effect.scoped,
  Effect.tapError((e) => Console.error(`site:test failed:\n${String(e)}`)),
  Effect.provide(BunFileSystem.layer),
  BunRuntime.runMain,
)
