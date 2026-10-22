// Contract for the local index: BM25 finds the right page, near-duplicates
// and repeat URLs are skipped, FTS syntax in queries is inert, the index
// survives reopen, and RRF merges ranked lists deterministically.
import { expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { ConfigProvider, Effect } from 'effect'
import { headingText } from '../../src/lib/crawl-types.ts'
import {
  addPages,
  fuseRanked,
  type LocalIndex,
  openLocalIndex,
  searchLocal,
  searchLocalIndex,
} from '../../src/lib/local-index.ts'
import { localIndexPath } from '../../src/lib/local-index-path.ts'
import { hamming, simhash64 } from '../../src/lib/simhash.ts'
import { tmpDir } from '../_support/run.ts'

const tides = {
  url: 'https://a.test/tides',
  title: 'Tidal Power in the Bay of Fundy',
  text: 'The Bay of Fundy has the highest tides on Earth, with a range that can reach 16 metres.',
}
const metals = {
  url: 'https://b.test/metals',
  title: 'Dense Metals',
  text: 'Osmium and iridium are the densest naturally occurring elements; tungsten is close behind.',
}
const tidesCopy = { ...tides, url: 'https://mirror.test/tides', text: `${tides.text} ` }

const withIndex = <A, E>(path: string, use: (index: LocalIndex) => Effect.Effect<A, E>) =>
  Effect.scoped(Effect.flatMap(openLocalIndex(path), use))

test('BM25 ranks the matching page first and skips near-duplicates', () =>
  Effect.runPromise(
    withIndex(':memory:', (index) =>
      Effect.gen(function* () {
        const { added } = yield* addPages(index, [tides, metals, tidesCopy, tides])
        const hits = yield* searchLocal(index, 'densest element osmium', 5)
        expect(added).toBe(2)
        expect(hits[0]?.url).toBe(metals.url)
        expect(hits[0]?.description).toContain('Osmium')
      }),
    ),
  ))

test('query text with FTS5 syntax is treated as plain words', () =>
  Effect.runPromise(
    withIndex(':memory:', (index) =>
      Effect.gen(function* () {
        yield* addPages(index, [tides])
        const hits = yield* searchLocal(index, 'tides" OR NEAR(* -', 5)
        expect(hits.map((h) => h.url)).toEqual([tides.url])
        expect(yield* searchLocal(index, '  ?! ', 5)).toEqual([])
      }),
    ),
  ))

const dbPath = `${tmpdir()}/webular-local-index-contract.db`
const removeDb = Effect.forEach(
  ['', '-wal', '-shm'],
  (suffix) => Effect.ignore(Effect.tryPromise(() => Bun.file(`${dbPath}${suffix}`).delete())),
  { concurrency: 3 },
)

test('index persists across reopen and dedupes against stored fingerprints', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* removeDb
      yield* withIndex(dbPath, (index) => addPages(index, [tides]))
      const again = yield* withIndex(dbPath, (index) => addPages(index, [tidesCopy, metals]))
      expect(again).toEqual({ added: 1, duplicates: 1 })
    }).pipe(Effect.ensuring(removeDb)),
  ))

test('simhash keeps near texts within 3 bits and far texts apart', () => {
  const long = `${tides.text} ${metals.text} Engineers have tested in-stream turbines there since 2009 because the currents are strong and predictable. Each tidal cycle moves about 100 billion tonnes of seawater in and out of the bay.`
  const a = simhash64(`${long} today`)
  const b = simhash64(long)
  expect(hamming(a, b)).toBeLessThanOrEqual(3)
  expect(hamming(a, simhash64(metals.text))).toBeGreaterThan(10)
})

test('fuseRanked sums 1/(k+rank) by URL and keeps first-seen items', () => {
  const web = [
    { url: 'x', src: 'web' },
    { url: 'y', src: 'web' },
  ]
  const local = [
    { url: 'y', src: 'local' },
    { url: 'z', src: 'local' },
  ]
  const fused = fuseRanked([web, local])
  expect(fused.map((h) => h.url)).toEqual(['y', 'x', 'z'])
  expect(fused[0]?.src).toBe('web')
  expect(fuseRanked([])).toEqual([])
})

// Each test hands the index its own config and temp dir; process.env stays untouched.
const cacheIn = (dir: string) =>
  ConfigProvider.layer(
    ConfigProvider.fromEnvRecord({ WEBULAR_NO_CACHE: '0', WEBULAR_CACHE_DIR: dir }),
  )

test('a caller-supplied config decides where the local index lives', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const dir = yield* tmpDir('local-index-path-')
      const path = yield* localIndexPath.pipe(Effect.provide(cacheIn(dir)))
      expect(path).toBe(join(dir, 'local-index.sqlite'))
    }).pipe(Effect.scoped, Effect.provide(BunServices.layer)),
  ))

test('searchLocalIndex: the search step reads the shared index and fuses it after web hits', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const dir = yield* tmpDir('search-local-')
      const local = yield* Effect.scoped(
        Effect.flatMap(Effect.flatMap(localIndexPath, openLocalIndex), (i) => addPages(i, [tides])),
      ).pipe(Effect.andThen(searchLocalIndex('Fundy tides', 5)), Effect.provide(cacheIn(dir)))
      expect(local.map((h) => h.url)).toEqual([tides.url])
      const web = [{ url: 'https://w.test/1', title: 'w', description: '' }]
      expect(fuseRanked([web, local]).map((h) => h.url)).toEqual(['https://w.test/1', tides.url])
    }).pipe(Effect.scoped, Effect.provide(BunServices.layer)),
  ))

const guide = {
  url: 'https://c.test/guide',
  title: 'Turbine Field Guide',
  text: [
    'A short guide to running in-stream tidal turbines.',
    '# Setup',
    'Anchor the frame to bedrock before the first spring tide.',
    '## Cabling',
    'Run the export cable through a split pipe to stop abrasion on the seabed.',
    '# Upkeep',
    'Scrape barnacles from the blades every six months.',
  ].join('\n'),
}

test('a query that matches one section returns that chunk with its heading path', () =>
  Effect.runPromise(
    withIndex(':memory:', (index) =>
      Effect.gen(function* () {
        yield* addPages(index, [guide, metals])
        const [hit] = yield* searchLocal(index, 'export cable abrasion', 5)
        expect(hit?.url).toBe(guide.url)
        expect(hit?.section).toBe('Setup > Cabling')
        expect(hit?.description).toContain('split pipe')
        expect(hit?.description).not.toContain('barnacles')
      }),
    ),
  ))

test('crawled HTML keeps its h1-h6 headings as chunk heading paths', () =>
  Effect.runPromise(
    withIndex(':memory:', (index) =>
      Effect.gen(function* () {
        const html =
          '<p>Intro.</p><h1>Setup</h1><p>Bolt the frame.</p>' +
          '<h2 id="c">Cabling</h2><p>Split pipe stops abrasion.</p>'
        yield* addPages(index, [{ url: guide.url, title: guide.title, text: headingText(html) }])
        const [hit] = yield* searchLocal(index, 'abrasion', 5)
        expect(hit?.section).toBe('Setup > Cabling')
      }),
    ),
  ))

test('a stub section hands its snippet the section text that follows it', () =>
  Effect.runPromise(
    withIndex(':memory:', (index) =>
      Effect.gen(function* () {
        const text =
          '# Pricing\nSee the plans.\n## Plans\nThe Pro plan costs ten dollars each month.'
        yield* addPages(index, [{ url: guide.url, title: 'Pricing', text }])
        const [hit] = yield* searchLocal(index, 'pricing', 5)
        expect([hit?.section, hit?.description]).toEqual([
          'Pricing > Plans',
          'See the plans.\nThe Pro plan costs ten dollars each month.',
        ])
      }),
    ),
  ))
