// media, act, and scrape never fetch a page robots.txt disallows: media and act
// check the named url before any download or browser run; scrape checks every
// redirect hop. A block reads as a robots block, never as a network failure.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff, tmpDir } from '../_support/run.ts'

const page =
  '<html><title>P</title><body><article><p>Private text here.</p></article></body></html>'
const fx = useFixture((origin) => ({
  '/robots.txt': () => new Response('User-agent: *\nDisallow: /private'),
  '/private': () => new Response(page, { headers: { 'content-type': 'text/html' } }),
  '/hop': () => new Response(null, { status: 302, headers: { location: `${origin}/private` } }),
}))

test(
  'media refuses a disallowed url before downloading it',
  eff(
    Effect.gen(function* () {
      const dir = yield* tmpDir('robots-media-')
      const r = yield* runCli('src/commands/media.ts', [
        '--url',
        `${fx.origin}/private`,
        '--output',
        `${dir}/p.html`,
      ])
      expect(r.code).toBe(1)
      expect(r.err + r.out).toContain('robots.txt disallows /private')
      expect(fx.hits('/private')).toBe(0)
    }),
  ),
  60_000,
)

test(
  'act refuses a disallowed url before opening a browser',
  eff(
    Effect.gen(function* () {
      const r = yield* runCli('src/commands/act.ts', ['--url', `${fx.origin}/private`])
      expect(r.code).toBe(1)
      expect(r.err + r.out).toContain('robots.txt disallows /private')
      expect(fx.hits('/private')).toBe(0)
    }),
  ),
  60_000,
)

test(
  'scrape reports a disallowed redirect hop as a robots block and never fetches it',
  eff(
    Effect.gen(function* () {
      const r = yield* runCli('src/commands/scrape.ts', ['--url', `${fx.origin}/hop`, '--json'])
      expect(r.err + r.out).toContain('/private')
      expect(r.err + r.out).toMatch(/robots/i)
      expect(r.err + r.out).not.toMatch(/network|ECONNREFUSED/i)
      expect(fx.hits('/private')).toBe(0)
    }),
  ),
  60_000,
)
