// agent-browser binary: every capture spawns the package's native binary, not
// the node shim that adds a node start (about 250 ms) to each batch.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { agentBin, closeSessions, runBatch } from '../../src/lib/agentbrowser.ts'
import { eff } from '../_support/run.ts'

describe.skipIf(process.platform === 'linux')('agent-browser binary', () => {
  test(
    'resolves the native binary, which runs',
    eff(
      Effect.gen(function* () {
        const bin = yield* agentBin()
        expect(bin).toContain(`agent-browser-${process.platform}-${process.arch}`)
        const head = yield* Effect.promise(() =>
          Bun.file(bin ?? '')
            .slice(0, 2)
            .text(),
        )
        expect(head).not.toBe('#!')
        const res = yield* runBatch([['--version']])
        expect(res.code).not.toBe(127)
        yield* closeSessions
      }),
    ),
  )
})
