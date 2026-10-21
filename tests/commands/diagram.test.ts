// DIAGRAM contract — lists the XState machines in src/machines. Listing is the
// command's only job, so it takes no flag beyond the shared ones.
import { describe, expect, test } from 'bun:test'

import { Effect, Schema } from 'effect'
import { runCli } from '../_support/cli.ts'
import { eff } from '../_support/run.ts'

const runDiagram = (args: string[]) => runCli('src/commands/diagram.ts', args)

const decodeList = Schema.decodeUnknownEffect(
  Schema.fromJsonString(
    Schema.Struct({ count: Schema.Number, diagrams: Schema.Array(Schema.String) }),
  ),
)

describe('webular diagram — list the state machines', () => {
  test(
    'diagram --json exits 0 and returns diagram list',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runDiagram(['--json'])
        expect(code).toBe(0)
        const data = yield* decodeList(out)
        expect(data.count).toBeGreaterThanOrEqual(3)
        expect(data.diagrams).toContain('cli-dispatch')
      }),
    ),
    30_000,
  )
})
