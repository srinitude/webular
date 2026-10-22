// A `published` value with no time zone is UTC, not local time: the ranking is
// the same on every machine (run under TZ=UTC, America/New_York, Asia/Kolkata).
import { expect, test } from 'bun:test'
import { rankHits } from '../../../src/lib/sources/rank.ts'

const NOW = Date.UTC(2026, 9, 21, 12)
const hit = (url: string, published: string) => ({
  title: url,
  url,
  description: '',
  trust: 1,
  published,
})

test('a zoneless time an hour older than a Z time ranks after it', () => {
  const zoned = hit('zoned', '2026-10-21T10:00:00Z')
  const bare = hit('bare', '2026-10-21T09:00:00')
  expect(rankHits([bare, zoned], NOW).map((h) => h.url)).toEqual(['zoned', 'bare'])
})

test('a zoneless time an hour newer than a Z time ranks before it', () => {
  const zoned = hit('zoned', '2026-10-21T10:00:00Z')
  const bare = hit('bare', '2026-10-21T11:00:00')
  expect(rankHits([zoned, bare], NOW).map((h) => h.url)).toEqual(['bare', 'zoned'])
})
