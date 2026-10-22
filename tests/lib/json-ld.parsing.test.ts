// JSON-LD parsing edge cases: malformed blocks fail softly, and arrays, @graph,
// and nested mixes flatten into one fact per entity, capped per page.
import { describe, expect, test } from 'bun:test'
import { parseHTML } from 'linkedom'
import { pageMetadata } from '../../src/lib/json-ld.ts'

const facts = (...blocks: string[]) =>
  pageMetadata(
    parseHTML(blocks.map((b) => `<script type="application/ld+json">${b}</script>`).join(''))
      .document,
  )?.jsonLd

describe('json-ld parsing', () => {
  test.each(['', '   ', 'null', '42', '"text"', 'true', '{', '[{"name":"x"', 'not json'])(
    'block %p yields no facts and does not throw',
    (block) => {
      expect(facts(block)).toBeUndefined()
    },
  )

  test('a malformed block between valid ones costs only itself', () => {
    expect(facts('{"name":"A"}', '{bad', '{"name":"B"}')).toEqual([{ name: 'A' }, { name: 'B' }])
  })

  test('an array of graphs, and a graph inside a graph, flatten in document order', () => {
    const arrayOfGraphs = JSON.stringify([
      { '@graph': [{ name: 'A1' }, { name: 'A2' }] },
      { name: 'B', '@graph': { name: 'B1' } },
    ])
    const nested = JSON.stringify({ '@graph': [{ name: 'C', '@graph': [{ name: 'C1' }] }] })
    expect(facts(arrayOfGraphs, nested)).toEqual([
      { name: 'A1' },
      { name: 'A2' },
      { name: 'B' },
      { name: 'B1' },
      { name: 'C' },
      { name: 'C1' },
    ])
  })

  test('non-object array members are ignored', () => {
    expect(facts(JSON.stringify([1, 'x', null, [], { name: 'Only' }]))).toEqual([{ name: 'Only' }])
  })

  test('at most 50 facts are kept per page', () => {
    const many = JSON.stringify(Array.from({ length: 80 }, (_, i) => ({ name: `n${i}` })))
    const kept = facts(many)
    expect(kept).toHaveLength(50)
    expect(kept?.[49]).toEqual({ name: 'n49' })
  })
})
