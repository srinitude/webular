// SUMMARIZE typed output against a real local Bun.serve fixture: a page with
// no readable text returns an empty result with a reason, never raw HTML, and
// --text output stays the same across runs in deterministic mode. No mocks.
import { describe, expect, test } from 'bun:test'
import { Config, Effect, Schema } from 'effect'
import { runCli } from '../_support/cli.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const Pick = Schema.Struct({
  index: Schema.Number,
  start: Schema.Number,
  end: Schema.Number,
  text: Schema.String,
  source_url: Schema.NullOr(Schema.String),
})
const Output = Schema.fromJsonString(
  Schema.Struct({
    sentences: Schema.Array(Schema.String),
    summary: Schema.String,
    picks: Schema.Array(Pick),
    source_url: Schema.NullOr(Schema.String),
    reason: Schema.optional(Schema.String),
  }),
)
const decode = Schema.decodeUnknownEffect(Output)

const fixture = startFixture(() => ({
  '/empty': () =>
    new Response('<html><head><script>var x = 1</script></head><body><div></div></body></html>', {
      headers: { 'content-type': 'text/html' },
    }),
}))

const baseEnv = Effect.gen(function* () {
  const PATH = yield* Config.String('PATH').pipe(Config.orElse(() => Config.String('Path')))
  const HOME = yield* Config.String('HOME').pipe(Config.withDefault('/tmp'))
  return { PATH, HOME, WEBULAR_DETERMINISTIC: '1' }
})

const TEXT =
  'Bun ships a fast SQLite driver. Bun ships a fast SQLite driver today. The driver returns plain objects. Thanks for reading!'
const summarize = (args: string[]) =>
  Effect.flatMap(baseEnv, (env) => runCli('src/commands/summarize.ts', args, { env }))

const emptyPage = Effect.gen(function* () {
  const fx = yield* fixture
  const run = yield* summarize(['--url', `${fx.origin}/empty`, '--json'])
  const data = yield* decode(run.out)
  expect(data.picks).toEqual([])
  expect(data.summary).toBe('')
  expect(typeof data.reason).toBe('string')
  expect(data.source_url).toBe(`${fx.origin}/empty`)
  expect(run.out).not.toContain('<')
})

const sameTwice = Effect.gen(function* () {
  const args = ['--text', TEXT, '--sentences', '2', '--json']
  const a = yield* summarize(args)
  const b = yield* summarize(args)
  expect(a.out).toBe(b.out)
  const data = yield* decode(a.out)
  for (const p of data.picks) expect(TEXT.slice(p.start, p.end)).toBe(p.text)
  expect(data.source_url).toBeNull()
})

describe('webular summarize — typed extractive output', () => {
  test('a page with no extractable text returns empty with a reason', eff(emptyPage), 45_000)
  test('output is deterministic under WEBULAR_DETERMINISTIC=1', eff(sameTwice), 45_000)
})
