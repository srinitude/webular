// DIAGRAM contract — lists the XState machines in src/machines.
import { describe, expect, test } from 'bun:test'

import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { eff } from '../_support/run.ts'

const runDiagram = (args: string[]) => runCli('src/commands/diagram.ts', args)

describe('webular diagram — list the state machines', () => {
  test(
    'diagram --list --json exits 0 and returns diagram list',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runDiagram(['--list', '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(typeof data.count).toBe('number')
        expect(data.count).toBeGreaterThanOrEqual(3)
        expect(Array.isArray(data.diagrams)).toBe(true)
        expect(data.diagrams).toContain('cli-dispatch')
      }),
    ),
    15_000,
  )

  test(
    'diagram without flags also lists (render path removed)',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runDiagram(['--json'])
        expect(code).toBe(0)
        expect(JSON.parse(out).diagrams).toContain('cli-dispatch')
      }),
    ),
    30_000,
  )
})
