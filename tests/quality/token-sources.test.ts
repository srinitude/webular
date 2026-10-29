// Guard: every token in site/design/tokens.json, the dev.webular.grid rows included,
// names a dated source in site/design/token-sources.json, so the token set can be
// checked. A token with no source must say so as `unsourced` and give a reason.

import { expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import { read } from '../_support/repo-files.ts'
import { eff } from '../_support/run.ts'

const Sourced = Schema.Struct({
  value: Schema.Unknown,
  source: Schema.NonEmptyString,
  date: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  support: Schema.NonEmptyString,
})
const Unsourced = Schema.Struct({
  value: Schema.Unknown,
  status: Schema.Literal('unsourced'),
  reason: Schema.NonEmptyString,
})
const Sources = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Union([Sourced, Unsourced])),
)
const Json = Schema.fromJsonString(Schema.Unknown)

// Every leaf with a $value, keyed by its dotted path from the file root.
const leaves = (node: unknown, path: ReadonlyArray<string> = []): Array<[string, unknown]> => {
  if (typeof node !== 'object' || node === null) return []
  if ('$value' in node) return [[path.join('.'), node.$value]]
  return Object.entries(node).flatMap(([key, child]) =>
    key.startsWith('$') && key !== '$extensions' ? [] : leaves(child, [...path, key]),
  )
}

test(
  'every token in tokens.json has a sources entry with a source and a date, or a reason',
  eff(
    Effect.gen(function* () {
      const tokens = leaves(
        yield* Schema.decodeUnknownEffect(Json)(yield* read('site/design/tokens.json')),
      )
      const sources = yield* Schema.decodeUnknownEffect(Sources)(
        yield* read('site/design/token-sources.json'),
      )
      expect(tokens.some(([path]) => path.startsWith('$extensions.dev.webular.grid.'))).toBe(true)
      expect(tokens.filter(([path]) => !(path in sources)).map(([path]) => path)).toEqual([])
      // An entry carries the token's current value, so a changed token needs a fresh source.
      const stale = tokens.filter(([path, value]) => !Bun.deepEquals(sources[path]?.value, value))
      expect(stale.map(([path]) => path)).toEqual([])
      const paths = new Set(tokens.map(([path]) => path))
      expect(Object.keys(sources).filter((path) => !paths.has(path))).toEqual([])
    }),
  ),
)
