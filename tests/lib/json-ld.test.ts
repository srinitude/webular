// JSON-LD facts: text-only reads of ld+json blocks, with typed facts out and
// no throw on a bad or oversized block.
import { describe, expect, test } from 'bun:test'
import { parseHTML } from 'linkedom'
import { JSON_LD_MAX_BLOCK_CHARS, pageMetadata } from '../../src/lib/json-ld.ts'

const page = (...blocks: string[]): string =>
  `<html><head>${blocks
    .map((b) => `<script type="application/ld+json">${b}</script>`)
    .join('')}</head><body><p>hi</p></body></html>`

const facts = (html: string) => pageMetadata(parseHTML(html).document)?.jsonLd

describe('json-ld facts', () => {
  test('a valid block yields name, url, datePublished, authors, and sameAs', () => {
    const block = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      name: 'Glacier Notes',
      url: 'https://acme.test/glacier',
      datePublished: '2026-01-02',
      author: [{ '@type': 'Person', name: 'Ada' }, 'Grace'],
      sameAs: ['https://x.test/acme', 'https://y.test/acme'],
    })
    expect(facts(page(block))).toEqual([
      {
        name: 'Glacier Notes',
        url: 'https://acme.test/glacier',
        datePublished: '2026-01-02',
        author: ['Ada', 'Grace'],
        sameAs: ['https://x.test/acme', 'https://y.test/acme'],
      },
    ])
  })

  test('an @graph block and a top-level array each yield one fact per entity', () => {
    const graph = JSON.stringify({
      '@graph': [
        { '@type': 'WebSite', name: 'Acme', url: 'https://acme.test/' },
        { '@type': 'Person', name: 'Ada', sameAs: 'https://x.test/ada' },
      ],
    })
    const list = JSON.stringify([{ name: 'One' }, { name: 'Two' }])
    expect(facts(page(graph, list))).toEqual([
      { name: 'Acme', url: 'https://acme.test/' },
      { name: 'Ada', sameAs: ['https://x.test/ada'] },
      { name: 'One' },
      { name: 'Two' },
    ])
  })

  test('a malformed block is skipped without a throw, and later blocks still count', () => {
    const good = JSON.stringify({ name: 'Kept' })
    expect(facts(page('{"name": "broken"', good))).toEqual([{ name: 'Kept' }])
    expect(facts(page('{"name": "broken"'))).toBeUndefined()
  })

  test('an oversized block is skipped', () => {
    const big = JSON.stringify({ name: 'Big', pad: 'x'.repeat(JSON_LD_MAX_BLOCK_CHARS) })
    expect(facts(page(big, JSON.stringify({ name: 'Small' })))).toEqual([{ name: 'Small' }])
  })

  test('a page without facts has no metadata', () => {
    expect(facts('<html><body>none</body></html>')).toBeUndefined()
    expect(facts(page('{"@type":"Thing"}'))).toBeUndefined()
  })
})
