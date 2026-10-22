// At the limit cut, no path prefix takes more than its fair share while others wait.
import { describe, expect, test } from 'bun:test'
import { capPrefixes } from '../../src/workflows/map-xml.ts'

const u = (p: string) => `https://a.test${p}`

describe('map prefix cap (2602.15921)', () => {
  test('a crowded prefix yields room to other prefixes, order kept', () => {
    const links = ['/blog/1', '/blog/2', '/blog/3', '/blog/4', '/docs/a', '/about'].map(u)
    expect(capPrefixes(links, 4)).toEqual(['/blog/1', '/blog/2', '/docs/a', '/about'].map(u))
  })
  test('backfills from capped prefixes when others run out', () => {
    const links = ['/blog/1', '/blog/2', '/blog/3', '/docs/a'].map(u)
    expect(capPrefixes(links, 3)).toEqual(['/blog/1', '/blog/2', '/docs/a'].map(u))
  })
  test('under the limit: unchanged', () => {
    const links = ['/x/1', '/x/2'].map(u)
    expect(capPrefixes(links, 5)).toEqual(links)
  })
})
