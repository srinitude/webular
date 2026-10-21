// Every free source has a stable or validation role and a trust; each command
// asks its stable sources before any validation source, and the main fused
// ranking reads the same trust table by host.
import { expect, test } from 'bun:test'
import { scoreHits } from '../../src/lib/search.ts'
import { FREE_SOURCES, SOURCE_ROLE, SOURCE_TRUST } from '../../src/lib/sources/catalog.ts'
import { FREE_SOURCE_ORDER } from '../../src/lib/sources/registry.ts'
import { hostTrust } from '../../src/lib/sources/roles.ts'

test('every source has a role and a trust', () => {
  for (const s of Object.keys(FREE_SOURCES) as Array<keyof typeof FREE_SOURCES>) {
    expect(['stable', 'validation']).toContain(SOURCE_ROLE[s])
    expect(SOURCE_TRUST[s]).toBeGreaterThan(0)
  }
})

test('each command asks every stable source before any validation source', () => {
  for (const order of Object.values(FREE_SOURCE_ORDER)) {
    const roles = order.map((s) => SOURCE_ROLE[s])
    const firstCheck = roles.indexOf('validation')
    if (firstCheck >= 0) expect(roles.slice(firstCheck)).not.toContain('stable')
  }
})

test('main ranking: of two first places, the more trusted host leads', () => {
  const hn = { title: 'a', url: 'https://news.ycombinator.com/item?id=1', description: '' }
  const wd = { title: 'b', url: 'https://www.wikidata.org/wiki/Q2807', description: '' }
  expect(hostTrust(wd.url)).toBeGreaterThan(hostTrust(hn.url))
  expect(scoreHits([[hn], [wd]], 'zzz qqq')[0]?.hit).toBe(wd)
})

test('the trust term stays below one rank step at the top', () => {
  const hn = { title: 'a', url: 'https://news.ycombinator.com/item?id=1', description: '' }
  const plain = { title: 'b', url: 'https://plain.example/x', description: '' }
  expect(scoreHits([[plain, hn]], 'zzz qqq')[0]?.hit).toBe(plain)
})
