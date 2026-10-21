// SUMMARIZE free-source fallback (2603.01548), against a real local Bun.serve
// fixture (WEBULAR_SOURCE_ORIGIN swaps every endpoint origin). The requested
// url answers 404, so summarize asks the free sources; only Wikidata answers,
// with an entity whose page lives on the fixture. No mocks.
import { describe, expect, test } from 'bun:test'
import { Config, Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const page = '<html><body><h1>Douglas Adams</h1><p>An English writer.</p></body></html>'

const fixture = startFixture((origin) => ({
  '/w/api.php': () =>
    Response.json({
      search: [{ id: 'Q42', label: 'Douglas Adams', concepturi: `${origin}/doc` }],
    }),
  '/doc': () => new Response(page, { headers: { 'content-type': 'text/html' } }),
}))

const summarize = eff(
  Effect.gen(function* () {
    const fx = yield* fixture
    const PATH = yield* Config.String('PATH').pipe(Config.orElse(() => Config.String('Path')))
    const HOME = yield* Config.String('HOME').pipe(Config.withDefault('/tmp'))
    const env = { PATH, HOME, WEBULAR_SOURCE_ORIGIN: fx.origin, WEBULAR_SOURCE_GAP_MS: '0' }
    const args = ['--url', `${fx.origin}/gone`, '--json']
    const run = yield* runCli('src/commands/summarize.ts', args, { env })
    expect(run.out).toContain('English writer')
  }),
)

describe('webular summarize — free-source fallback', () => {
  test('a failing url fetch falls back to the free sources', summarize, 45_000)
})
