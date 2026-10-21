// RESEARCH free-source fallback (2603.01548), against a real local Bun.serve
// fixture (WEBULAR_SOURCE_ORIGIN swaps every endpoint origin). DuckDuckGo
// ('/html/') has no route and fails, so research asks the free sources; only
// Wikidata answers, with an entity whose page lives on the fixture. No mocks.
import { describe, expect, test } from 'bun:test'
import { Config, Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const entity = (origin: string) => ({
  search: [{ id: 'Q42', label: 'Douglas Adams', concepturi: `${origin}/doc` }],
})

const page = '<html><body><h1>Douglas Adams</h1><p>An English writer.</p></body></html>'

const fixture = startFixture((origin) => ({
  '/w/api.php': () => Response.json(entity(origin)),
  '/doc': () => new Response(page, { headers: { 'content-type': 'text/html' } }),
}))

const research = eff(
  Effect.gen(function* () {
    const fx = yield* fixture
    // Windows spells the variable `Path`.
    const PATH = yield* Config.String('PATH').pipe(Config.orElse(() => Config.String('Path')))
    const HOME = yield* Config.String('HOME').pipe(Config.withDefault('/tmp'))
    const env = { PATH, HOME, WEBULAR_SOURCE_ORIGIN: fx.origin }
    const args = ['--topic', 'douglas adams', '--depth', '1', '--json']
    const run = yield* runCli('src/commands/research.ts', args, { env })
    // The entity page reached research either as a source or as a fetch error.
    expect(run.out + run.err).toContain(`${fx.origin}/doc`)
  }),
)

describe('webular research — free-source fallback', () => {
  test('a failing web search falls back to the free sources', research, 45_000)
})
