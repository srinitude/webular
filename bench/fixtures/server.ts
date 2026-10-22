// Fixture server for the benchmark: serves the whole bench/fixtures tree by
// path (pages/, sites/), /r/<path> as a 301 to <path>, and a robots.txt that
// disallows the robots-blocked pages. Unknown paths fall through to 404.
import { Effect } from 'effect'
import { type Routes, startFixture } from '../../tests/_support/fixture'

const ROOT = import.meta.dir

export const ROBOTS_TXT = 'User-agent: *\nDisallow: /pages/blocked/\nDisallow: /sites/private/\n'

// Every path the core must never echo into output: loopback hosts and the
// fixture path prefixes.
const FIXTURE_URL_PATTERNS: ReadonlyArray<RegExp> = [
  /127\.0\.0\.1/,
  /\blocalhost\b/i,
  /\[::1\]/,
  /fixture:\/\//,
  /bench\/fixtures\//,
  /\/pages\/(article|forum|product|listing|docs|tables|pdf-text|pdf-scanned|spa|lazy-scroll|non-english|blocked)\//,
  /\/sites\//,
  /\/gone\/job-/,
]

export const leaksFixtureUrl = (text: string): boolean =>
  FIXTURE_URL_PATTERNS.some((p) => p.test(text))

const listFiles = Effect.sync(() => [
  // Windows scans with `\`; routes are URL paths.
  ...Array.from(new Bun.Glob('{pages,sites}/**/*').scanSync({ cwd: ROOT, onlyFiles: true }), (f) =>
    f.replaceAll('\\', '/'),
  ),
])

const routesFor = (files: ReadonlyArray<string>): Routes =>
  Object.fromEntries([
    ['/robots.txt', () => new Response(ROBOTS_TXT, { headers: { 'content-type': 'text/plain' } })],
    ['/status/404', () => new Response('not found', { status: 404 })],
    ...files.flatMap((f) => [
      [`/${f}`, () => new Response(Bun.file(`${ROOT}/${f}`))],
      [`/r/${f}`, () => new Response(null, { status: 301, headers: { location: `/${f}` } })],
    ]),
  ])

// Scoped: the server stops when the enclosing Scope closes.
export const startBenchFixture = Effect.flatMap(listFiles, (files) =>
  startFixture(() => routesFor(files)),
)
