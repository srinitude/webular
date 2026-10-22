// ANSWER conflict note (2608.22228), against a real local Bun.serve fixture
// read with --urls: two pages give different figures for the same fact, so the
// answer says the sources disagree and names both. No mocks, no Jev key.
import { describe, expect, test } from 'bun:test'
import { Config, Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const html = (p: string) =>
  new Response(`<html><body><h1>Lisbon</h1><p>${p}</p></body></html>`, {
    headers: { 'content-type': 'text/html' },
  })
const fixture = startFixture(() => ({
  '/a': () => html('About 545,000 people live in Lisbon today.'),
  '/b': () => html('About 505,000 people live in Lisbon today.'),
}))

const answer = eff(
  Effect.gen(function* () {
    const fx = yield* fixture
    const PATH = yield* Config.String('PATH').pipe(Config.orElse(() => Config.String('Path')))
    const HOME = yield* Config.String('HOME').pipe(Config.withDefault('/tmp'))
    const urls = ['--urls', `${fx.origin}/a`, '--urls', `${fx.origin}/b`]
    const args = ['--query', 'How many people live in Lisbon?', ...urls, '--json']
    const run = yield* runCli('src/commands/answer.ts', args, {
      env: { PATH, HOME, WEBULAR_ALLOW_PRIVATE: '1' },
    })
    expect(run.out).toContain(`Sources disagree: ${fx.origin}/a gives 545,000`)
    expect(run.out).toContain(`${fx.origin}/b gives 505,000`)
  }),
)

describe('webular answer — sources that disagree', () => {
  test('two pages with different figures get a note naming both', answer, 45_000)
})
