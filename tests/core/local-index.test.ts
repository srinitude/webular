// Contract for the local index: BM25 finds the right page, near-duplicates
// and repeat URLs are skipped, FTS syntax in queries is inert, the index
// survives reopen, and RRF merges ranked lists deterministically.
import { expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { Effect } from 'effect'
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

// The cache env vars are set for the test and put back on every exit path.
const cacheEnv = Effect.acquireRelease(
  Effect.sync(() => {
    const saved = { off: process.env['WEBULAR_NO_CACHE'], dir: process.env['WEBULAR_CACHE_DIR'] }
    process.env['WEBULAR_NO_CACHE'] = '0'
    process.env['WEBULAR_CACHE_DIR'] = `${tmpdir()}/search-local-${process.pid}`
    return saved
  }),
  (saved) =>
    Effect.sync(() => {
      process.env['WEBULAR_NO_CACHE'] = saved.off ?? '1'
      if (saved.dir === undefined) delete process.env['WEBULAR_CACHE_DIR']
      else process.env['WEBULAR_CACHE_DIR'] = saved.dir
    }),
)

test('searchLocalIndex: the search step reads the shared index and fuses it after web hits', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* cacheEnv
      yield* Effect.scoped(
        Effect.flatMap(Effect.flatMap(localIndexPath, openLocalIndex), (i) => addPages(i, [tides])),
      )
      const local = yield* searchLocalIndex('Fundy tides', 5)
      expect(local.map((h) => h.url)).toEqual([tides.url])
      const web = [{ url: 'https://w.test/1', title: 'w', description: '' }]
      expect(fuseRanked([web, local]).map((h) => h.url)).toEqual(['https://w.test/1', tides.url])
    }).pipe(Effect.scoped),
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
