// withArchiveCopy against a real local Bun.serve fixture. WEBULAR_SOURCE_ORIGIN
// (through the ConfigProvider) points the availability lookup at the fixture,
// whose availability body is the recorded wayback-available.json with its
// web.archive.org host swapped for the fixture. Disk cache off; no live network.
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { ConfigProvider, Effect, FileSystem } from 'effect'
import { fetchText } from '../../../src/core/http.ts'
import { downloadToFile } from '../../../src/lib/download.ts'
import { ArchiveCopyError, withArchiveCopy } from '../../../src/lib/sources/archive-copy.ts'
import { fetchSources } from '../../../src/lib/sources.ts'
import { startFixture } from '../../_support/fixture.ts'
import { eff, tmpDir } from '../../_support/run.ts'
import { body, json } from './support.ts'

const CAPTURE = '/web/20261021030512id_/https://example.com/'
const NO_CACHE = { cache: false }

// 'cdx': the availability API has nothing and the recorded CDX lists captures.
const inFixture = <A, E, R>(
  hasCapture: boolean | 'cdx',
  use: (origin: string) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const available = yield* body('wayback-available.json')
    const page = yield* body('archive-copy-page.html')
    const cdx = yield* body('wayback-cdx.json')
    const fx = yield* startFixture((origin) => ({
      '/dead': () => new Response('gone', { status: 410 }),
      '/live': () => new Response('<h1>Live</h1>', { headers: { 'content-type': 'text/html' } }),
      '/wayback/available': () =>
        json(
          hasCapture === true
            ? available.replace('http://web.archive.org', origin)
            : '{"archived_snapshots":{}}',
        ),
      '/cdx/search/cdx': () => json(hasCapture === 'cdx' ? cdx : '[]'),
      [CAPTURE]: () => new Response(page, { headers: { 'content-type': 'text/html' } }),
    }))
    const config = {
      WEBULAR_SOURCE_ORIGIN: fx.origin,
      WEBULAR_SOURCE_GAP_MS: '0',
      WEBULAR_NO_CACHE: '1',
    }
    const out = yield* Effect.provideService(
      use(fx.origin),
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown(config),
    )
    return { out, fx }
  })

const page = (origin: string, path: string) =>
  withArchiveCopy(`${origin}${path}`, fetchText(`${origin}${path}`, NO_CACHE), (capture) =>
    fetchText(capture, NO_CACHE),
  )

describe('withArchiveCopy — fetch, then the Internet Archive copy', () => {
  test(
    'a dead page (410) is read from the archive copy',
    eff(
      Effect.gen(function* () {
        const { out, fx } = yield* inFixture(true, (origin) => page(origin, '/dead'))
        expect(out.value).toContain('Archived Example')
        expect(out.archivedFrom).toBe(`${fx.origin}${CAPTURE}`)
      }),
    ),
  )

  test(
    'the CDX index names the capture when the availability API has none',
    eff(
      Effect.gen(function* () {
        const { out } = yield* inFixture('cdx', (origin) =>
          withArchiveCopy(`${origin}/dead`, fetchText(`${origin}/dead`, NO_CACHE), Effect.succeed),
        )
        expect(out.archivedFrom).toBe(
          'https://web.archive.org/web/20020120142510id_/http://example.com:80/',
        )
      }),
    ),
  )

  test(
    'a live page never asks the archive',
    eff(
      Effect.gen(function* () {
        const { out, fx } = yield* inFixture(true, (origin) => page(origin, '/live'))
        expect(out.value).toContain('Live')
        expect(out.archivedFrom).toBeUndefined()
        expect(fx.hits('/wayback/available')).toBe(0)
      }),
    ),
  )

  test(
    'no archive copy: one error naming the URL, the live failure, and the archive failure',
    eff(
      Effect.gen(function* () {
        const { out } = yield* inFixture(false, (origin) => Effect.flip(page(origin, '/dead')))
        expect(out).toBeInstanceOf(ArchiveCopyError)
        expect(out.message).toMatch(/\/dead: the live fetch failed \(.*410.*\)/)
        expect(out.message).toMatch(/the archive copy failed \(the archive has no capture\)/)
      }),
    ),
  )

  test(
    'answer and research read a dead source from the archive copy',
    eff(
      Effect.gen(function* () {
        const { out } = yield* inFixture(true, (origin) =>
          fetchSources([{ title: 'Dead', url: `${origin}/dead` }], 5_000),
        )
        expect(out.errors).toEqual([])
        expect(out.entries[0]?.text).toContain('Internet Archive')
      }),
    ),
  )

  test(
    'a dead source with no archive copy is one reported error, not a failed run',
    eff(
      Effect.gen(function* () {
        const { out } = yield* inFixture(false, (origin) =>
          fetchSources([{ title: 'Dead', url: `${origin}/dead` }], 5_000),
        )
        expect(out.entries).toEqual([])
        expect(out.errors[0]?.reason).toMatch(/live fetch failed .*410.*archive has no capture/)
      }),
    ),
  )

  test(
    'a dead download is saved from the archive copy',
    eff(
      Effect.gen(function* () {
        const dest = join(yield* tmpDir('webular-'), 'copy.html')
        const { out } = yield* inFixture(true, (origin) =>
          withArchiveCopy(`${origin}/dead`, downloadToFile(`${origin}/dead`, dest), (capture) =>
            downloadToFile(capture, dest),
          ),
        )
        const text = yield* (yield* FileSystem.FileSystem).readFileString(dest)
        expect(text).toContain('Archived Example')
        expect(out.archivedFrom).toContain('id_/')
      }),
    ),
  )

  test(
    'a dead download with no archive copy fails with the same clear error',
    eff(
      Effect.gen(function* () {
        const dest = join(yield* tmpDir('webular-'), 'none.html')
        const { out } = yield* inFixture(false, (origin) =>
          Effect.flip(
            withArchiveCopy(`${origin}/dead`, downloadToFile(`${origin}/dead`, dest), (capture) =>
              downloadToFile(capture, dest),
            ),
          ),
        )
        expect(out).toBeInstanceOf(ArchiveCopyError)
        expect(out.message).toMatch(/live fetch failed .*archive copy failed/)
      }),
    ),
  )
})
