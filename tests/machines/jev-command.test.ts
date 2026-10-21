// Model-based test: every path of the jev command machine, replayed against the
// real `src/commands/jev.ts` process with a private state folder.
import { describe, expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { jevCommandMachine } from '../../src/machines/jev-command.ts'
import { runCli } from '../_support/cli.ts'
import { exitCodeOf, finalPaths } from '../_support/paths.ts'
import { eff, tmpDir } from '../_support/run.ts'

const row = {
  id: 'call-42',
  at: '2026-10-21T00:00:00.000Z',
  decision: 'crawl.link',
  model: null,
  payloadHash: 'abc123',
  questionKinds: { content: 'choice' },
  pick: { content: 'yes' },
  confidence: 0.9,
  latencyMs: 12,
  inputTokens: 0,
  codeCheck: null,
  fallback: false,
}

// argv for each path; learn fails when its lessons file's path is a folder.
const SCENARIO: Record<string, { argv: string[]; lessonsBlocked?: boolean }> = {
  HELP: { argv: ['--help'] },
  USAGE_ERROR: { argv: ['bogus'] },
  'LEARN SUCCEEDED': { argv: ['learn'] },
  'LEARN FAILED': { argv: ['learn'], lessonsBlocked: true },
  'CORRECT SUCCEEDED': { argv: ['correct', 'call-42', 'yes'] },
  'CORRECT FAILED': { argv: ['correct', 'nope', 'yes'] },
}

const paths = finalPaths(jevCommandMachine, [
  'HELP',
  'LEARN',
  'CORRECT',
  'USAGE_ERROR',
  'SUCCEEDED',
  'FAILED',
])

describe('jev command machine matches src/commands/jev.ts', () => {
  test('the model has one scenario per path', () => {
    expect(paths.map((p) => p.events.join(' ')).sort()).toEqual(Object.keys(SCENARIO).sort())
  })

  test.each(paths.map((p) => [p.final, p] as const))(
    '%s',
    (_name, path) =>
      eff(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem
          const dir = yield* tmpDir('webular-jev-machine-')
          const { argv, lessonsBlocked } = SCENARIO[path.events.join(' ')] ?? { argv: [] }
          yield* fs.writeFileString(`${dir}/jev-calls.jsonl`, `${JSON.stringify(row)}\n`)
          if (lessonsBlocked) yield* fs.makeDirectory(`${dir}/jev-lessons.json`)
          const env = { WEBULAR_STATE_DIR: dir, WEBULAR_JEV: 'off' }
          const { code } = yield* runCli('src/commands/jev.ts', argv, {
            env,
            exec: process.execPath,
          })
          expect(code).toBe(exitCodeOf(path))
        }),
      )(),
    60_000,
  )
})
