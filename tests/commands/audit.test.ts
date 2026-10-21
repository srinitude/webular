// AUDIT contract — keyless, offline availability report. deepsec is a local
// devDependency; the probe must never reach for the npm registry.
import { describe, expect, test } from 'bun:test'

import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { eff } from '../_support/run.ts'

const runAudit = (args: string[]) => runCli('src/commands/audit.ts', args)

describe('webular audit — keyless deepsec availability + scan plan', () => {
  test(
    '--json reports tool, availability and a registry-free command',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runAudit(['--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.tool).toBe('deepsec')
        expect(data.available).toBe(true)
        expect(data.command).toContain('deepsec')
        expect(data.command).not.toContain('npx')
      }),
    ),
    15_000,
  )

  test(
    'human output names the availability and the command',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runAudit([])
        expect(code).toBe(0)
        expect(out).toContain('deepsec: available')
        expect(out).toContain('command:')
      }),
    ),
    15_000,
  )
})
