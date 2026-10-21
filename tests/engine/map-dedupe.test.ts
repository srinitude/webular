// map dedupe stops reading once `limit` links are kept; its output must equal
// a full dedupe followed by slice(0, limit).
import { describe, expect, test } from 'bun:test'
import { normalizeUrl } from '../../src/core/url.ts'
import { dedupe } from '../../src/workflows/map.ts'

const fullThenSlice = (links: string[], limit: number): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const link of links) {
    const n = normalizeUrl(link)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out.slice(0, limit)
}

describe('map dedupe — early stop keeps the same prefix', () => {
  const links = [
    'https://a.test/x',
    'not a url',
    'https://a.test/x',
    'https://a.test/y#frag',
    'https://a.test/y',
    'https://a.test/z',
    '',
    'https://a.test/w',
  ]
  for (const limit of [0, 1, 2, 3, 10]) {
    test(`limit ${limit}`, () => {
      expect(dedupe(links, limit)).toEqual(fullThenSlice(links, limit))
    })
  }
})
