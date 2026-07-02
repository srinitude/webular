// ACT contract — real browser automation via agent-browser (no mocks).
// The live snapshot test runs only when the agent-browser binary is present.
import { describe, expect, test } from 'bun:test'
import { available } from '../../src/lib/agentbrowser.ts'

import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'

const runAct = (args: string[]) => runCli('src/commands/act.ts', args)

// A usable browser is a machine property (agent-browser install); opt in with
// WEBULAR_TEST_LIVE=1. The missing-arg contract always runs.
describe('webular act — real browser automation via agent-browser', () => {
  test.skipIf(!available() || !process.env.WEBULAR_TEST_LIVE)(
    'snapshots a live page accessibility tree',
    async () => {
      const { code, out } = await runAct(['--url', 'https://example.com', '--json'])
      expect(code).toBe(0)
      expect(out).toContain('Example Domain')
    },
    60_000,
  )

  test('exits with code 2 when the URL is missing', async () => {
    const { code, err } = await runAct([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })
})
