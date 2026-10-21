// ACT contract — real browser automation via agent-browser (no mocks).
// The live snapshot test runs only when the agent-browser binary is present.
import { describe, expect, test } from 'bun:test'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Effect } from 'effect'
import { available } from '../../src/lib/agentbrowser.ts'
import { runCli } from '../_support/cli.ts'
import { eff } from '../_support/run.ts'

const runAct = (args: string[]) => runCli('src/commands/act.ts', args)

// A usable browser is a machine property (agent-browser install); opt in with
// WEBULAR_TEST_LIVE=1. The missing-arg contract always runs.
describe('webular act — real browser automation via agent-browser', () => {
  test.skipIf(
    !Effect.runSync(Effect.provide(available(), BunServices.layer)) ||
      !process.env['WEBULAR_TEST_LIVE'],
  )(
    'snapshots a live page accessibility tree',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runAct(['--url', 'https://example.com', '--json'])
        expect(code).toBe(0)
        expect(out).toContain('Example Domain')
      }),
    ),
    60_000,
  )

  test(
    'exits with code 2 when the URL is missing',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runAct([])
        expect(code).toBe(2)
        expect(err).toContain('missing')
      }),
    ),
  )
})
