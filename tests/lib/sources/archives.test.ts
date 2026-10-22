// Wayback availability, Wayback CDX, and Library of Congress adapters against
// a real local Bun.serve fixture (WEBULAR_SOURCE_ORIGIN, given through the
// ConfigProvider, swaps the origin; the path stays). Wayback bodies are
// recorded live responses; Library of Congress follows its documented shape
// (the live call returned HTML after 30 s).
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { livePageUrls } from '../../../src/lib/archive-urls.ts'
import {
  libraryOfCongress,
  waybackAvailable,
  waybackCdx,
} from '../../../src/lib/sources/archives.ts'
import { against, body, json, run, serving } from './support.ts'

const availableCase = Effect.gen(function* () {
  const text = yield* body('wayback-available.json')
  const { out, seen } = yield* serving(
    '/wayback/available',
    text,
    waybackAvailable('example.com', 5),
  )
  expect(out).toHaveLength(1)
  expect(out[0]?.url).toContain('web.archive.org/web/')
  expect(seen.query.get('url')).toBe('example.com')
})

const noSnapshotCase = Effect.gen(function* () {
  const empty = '{"archived_snapshots":{}}'
  const { out } = yield* serving('/wayback/available', empty, waybackAvailable('nope.invalid', 5))
  expect(out).toEqual([])
})

const queryWith = (extra: Record<string, string>) =>
  Effect.gen(function* () {
    const text = yield* body('wayback-available.json')
    const seen = { query: new URLSearchParams() }
    const route = (_req: Request, url: URL) => {
      seen.query = url.searchParams
      return json(text)
    }
    yield* against({ '/wayback/available': route }, waybackAvailable('example.com', 5), extra)
    return seen.query
  })

const pinnedCase = Effect.gen(function* () {
  expect((yield* queryWith({ WEBULAR_AS_OF: '2020-03-15' })).get('timestamp')).toBe('20200315')
})

const unpinnedCase = Effect.gen(function* () {
  expect((yield* queryWith({})).has('timestamp')).toBe(false)
})

const cdxCase = Effect.gen(function* () {
  const text = yield* body('wayback-cdx.json')
  const { out, seen } = yield* serving('/cdx/search/cdx', text, waybackCdx('example.com', 2))
  expect(out.length).toBeGreaterThan(0)
  expect(out.length).toBeLessThanOrEqual(2)
  for (const h of out) expect(h.url).toMatch(/^https:\/\/web\.archive\.org\/web\/\d{14}\//)
  expect(seen.query.get('output')).toBe('json')
})

const locCase = Effect.gen(function* () {
  const text = yield* body('loc-search.json')
  const { out, seen } = yield* serving('/search/', text, libraryOfCongress('effect', 2))
  expect(out.length).toBeGreaterThan(0)
  for (const h of out) expect(h.url).toStartWith('http')
  expect(seen.query.get('fo')).toBe('json')
  expect(seen.query.get('c')).toBe('2')
})

describe('archive adapters', () => {
  test('waybackAvailable returns the closest snapshot as one hit', () => run(availableCase))
  test('waybackAvailable with no snapshot returns no hits', () => run(noSnapshotCase))
  test('waybackAvailable asks for the pinned date', () => run(pinnedCase))
  test('waybackAvailable sends no timestamp when unpinned', () => run(unpinnedCase))
  test('waybackCdx skips the header row and builds snapshot urls', () => run(cdxCase))
  test('libraryOfCongress maps results to hits', () => run(locCase))
})

const hit = (url: string, description: string) => ({ title: url, url, description })

test('archive fallback keeps only same-host HTML captures that returned 200, once each', () => {
  const urls = livePageUrls('example.com', [
    hit('https://web.archive.org/web/2024id_/https://example.com/a', '2024 text/html HTTP 200'),
    hit('https://web.archive.org/web/2023/https://example.com/a', '2023 text/html HTTP 200'),
    hit('https://example.com/gone', 'CC-MAIN 2024 text/html HTTP 404'),
    hit('https://example.com/logo.png', 'CC-MAIN 2024 image/png HTTP 200'),
    hit('https://web.archive.org/web/2024/https://example.com/moved', '2024 text/html HTTP 301'),
    hit('https://example.com/b', 'CC-MAIN 2024 application/xhtml+xml HTTP 200'),
    hit('https://other.org/c', 'CC-MAIN 2024 text/html HTTP 200'),
  ])
  expect(urls).toEqual(['https://example.com/a', 'https://example.com/b'])
})
