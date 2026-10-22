// JSON-LD blocks real pages ship: comment and CDATA wrappers, trailing commas,
// and hostile nesting. One bad block never costs the good ones, and nothing throws.
import { describe, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { parseHTML } from 'linkedom'
import { pageMetadata } from '../../src/lib/json-ld.ts'

const wrapped = await Effect.runPromise(
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.readFileString(fileURLToPath(new URL('../fixtures/json-ld/wrapped.html', import.meta.url))),
  ).pipe(Effect.provide(BunServices.layer)),
)
const facts = (html: string) => pageMetadata(parseHTML(html).document)?.jsonLd

describe('json-ld tolerant reads', () => {
  test('comment and CDATA wrappers and trailing commas still yield facts; a broken block is skipped', () => {
    expect(facts(wrapped)).toEqual([
      { name: 'Comment' },
      { name: 'Cdata' },
      { name: 'Trailing, }', sameAs: ['https://x.test/a'] },
      { name: 'Good' },
    ])
  })

  test('a byte order mark before the JSON does not drop the block', () => {
    const html = '<script type="application/ld+json">﻿{"name":"Bom"}</script>'
    expect(facts(html)).toEqual([{ name: 'Bom' }])
  })

  test('deeply nested arrays are skipped without a throw, and later blocks still count', () => {
    const deep = `${'['.repeat(30_000)}{"name":"Deep"}${']'.repeat(30_000)}`
    const html = `<script type="application/ld+json">${deep}</script><script type="application/ld+json">{"name":"After"}</script>`
    expect(facts(html)).toEqual([{ name: 'After' }])
  })
})
