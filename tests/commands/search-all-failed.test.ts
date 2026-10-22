// SEARCH when every source fails: nothing found because the sources were down
// is a failure, not an empty answer. The JSON carries `errors` (one per failed
// source), stderr says so, and the command exits 1, like answer and research.
// A run where one source answered "no results" worked, so it stays exit 0 with
// no errors. Real local Bun.serve fixtures: one with no routes (every source
// gets a 404), one where only Wikipedia answers, empty. No mocks.
import { describe, expect, test } from 'bun:test'
import { Config, Effect, Schema } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff, tmpDir } from '../_support/run.ts'

const fx = useFixture(() => ({}))
const quiet = useFixture(() => ({
  '/w/api.php': (_req, url) =>
    Response.json(
      url.searchParams.get('action') === 'wbsearchentities'
        ? { search: [] }
        : { query: { search: [] } },
    ),
}))

const search = (origin: string) =>
  Effect.gen(function* () {
    const PATH = yield* Config.String('PATH').pipe(Config.orElse(() => Config.String('Path')))
    const HOME = yield* tmpDir('webular-search-down-')
    const env = { PATH, HOME, WEBULAR_SOURCE_ORIGIN: origin, WEBULAR_SOURCE_GAP_MS: '0' }
    return yield* runCli('src/commands/search.ts', ['--query', 'zzqx nothing', '--json'], { env })
  })

const Output = Schema.fromJsonString(
  Schema.Struct({
    count: Schema.Number,
    errors: Schema.Array(Schema.Struct({ url: Schema.String, reason: Schema.String })),
  }),
)

const Quiet = Schema.fromJsonString(
  Schema.Struct({ count: Schema.Number, errors: Schema.optional(Schema.Unknown) }),
)

describe('webular search: every source down', () => {
  test(
    'exits 1 with an errors list and a stderr note',
    eff(
      Effect.gen(function* () {
        const run = yield* search(fx.origin)
        expect(run.code).toBe(1)
        const data = yield* Schema.decodeUnknownEffect(Output)(run.out)
        expect(data.count).toBe(0)
        expect(data.errors.length).toBeGreaterThan(0)
        expect(data.errors.map((e) => e.url)).toContain('web')
        expect(run.err).toMatch(/failed/)
      }),
    ),
    60_000,
  )

  test(
    'one source answering with no results keeps exit 0 and no errors',
    eff(
      Effect.gen(function* () {
        const run = yield* search(quiet.origin)
        expect(run.code).toBe(0)
        const data = yield* Schema.decodeUnknownEffect(Quiet)(run.out)
        expect(data).toEqual({ count: 0 })
      }),
    ),
    60_000,
  )
})
