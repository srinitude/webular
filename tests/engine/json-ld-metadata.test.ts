// Scrape and extract carry the page's JSON-LD facts in their metadata.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const LD = JSON.stringify({
  '@graph': [
    {
      '@type': 'Article',
      name: 'Glacier Notes',
      url: 'https://acme.test/glacier',
      datePublished: '2026-01-02',
      author: { '@type': 'Person', name: 'Ada' },
      sameAs: ['https://x.test/acme'],
    },
  ],
})
const PAGE =
  '<!doctype html><html><head><title>Glacier Notes</title>' +
  `<script type="application/ld+json">${LD}</script></head>` +
  '<body><h1>Glacier Notes</h1><p class="lede">Ice moves slowly.</p></body></html>'
const FACTS = {
  jsonLd: [
    {
      name: 'Glacier Notes',
      url: 'https://acme.test/glacier',
      datePublished: '2026-01-02',
      author: ['Ada'],
      sameAs: ['https://x.test/acme'],
    },
  ],
}

const fx = useFixture(() => ({
  '/ld': () => new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
}))

const json = (command: string, args: string[]) =>
  Effect.gen(function* () {
    const { code, out } = yield* runCli(command, [...args, '--json'])
    expect(code).toBe(0)
    return JSON.parse(out) as { metadata?: unknown }
  })

describe('JSON-LD metadata', () => {
  test(
    'scrape returns the facts',
    eff(
      Effect.gen(function* () {
        const data = yield* json('src/commands/scrape.ts', [
          '--url',
          `${fx.origin}/ld`,
          '--render',
          'off',
        ])
        expect(data.metadata).toEqual(FACTS)
      }),
    ),
    30_000,
  )

  test(
    'extract returns the facts with a selector',
    eff(
      Effect.gen(function* () {
        const data = yield* json('src/commands/extract.ts', [
          '--url',
          `${fx.origin}/ld`,
          '--selector',
          '.lede',
        ])
        expect(data.metadata).toEqual(FACTS)
      }),
    ),
    30_000,
  )
})
