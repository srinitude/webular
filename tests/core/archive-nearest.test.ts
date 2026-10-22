// The Wayback fallback asks for the capture nearest the pinned date
// (WEBULAR_AS_OF) and sends no timestamp when nothing is pinned. Real local
// Bun.serve fixture; the fixture origin stands in for archive.org.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { fetchTextOrArchive } from '../../src/core/archive.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const STAMP = '20200316120000'

const fallback = (config: Record<string, string>) =>
  Effect.gen(function* () {
    const seen = { query: new URLSearchParams() }
    const fx = yield* startFixture((origin) => ({
      '/dead': () => new Response('gone', { status: 410 }),
      '/wayback/available': (_req, url) => {
        seen.query = url.searchParams
        const closest = {
          available: true,
          status: '200',
          url: `${origin}/web/${STAMP}/${origin}/dead`,
          timestamp: STAMP,
        }
        return new Response(JSON.stringify({ archived_snapshots: { closest } }))
      },
      [`/web/${STAMP}id_/${origin}/dead`]: () =>
        new Response('<p>captured</p>', { headers: { 'content-type': 'text/html' } }),
    }))
    const out = yield* Effect.provideService(
      fetchTextOrArchive(`${fx.origin}/dead`, { archiveOrigin: fx.origin }),
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown({ WEBULAR_NO_CACHE: '1', ...config }),
    )
    return { out, seen }
  })

const pinnedCase = Effect.gen(function* () {
  const { out, seen } = yield* fallback({ WEBULAR_AS_OF: '2020-03-15' })
  expect(seen.query.get('timestamp')).toBe('20200315')
  expect(out.html).toContain('captured')
  expect(out.archivedFrom).toContain(`${STAMP}id_`)
})

const unpinnedCase = Effect.gen(function* () {
  const { out, seen } = yield* fallback({})
  expect(seen.query.has('timestamp')).toBe(false)
  expect(out.html).toContain('captured')
})

test('closestCapture asks for the capture nearest the pinned date', eff(pinnedCase))
test('closestCapture sends no timestamp when no date is pinned', eff(unpinnedCase))
