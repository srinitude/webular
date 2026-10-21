// Model-based test: every path of the CLI dispatch machine, replayed against
// the real `bin/webular.ts` (real mise, real commands).
import { describe, expect, test } from 'bun:test'
import { cliDispatchMachine } from '../../src/machines/cli-dispatch.ts'
import { runCli } from '../_support/cli.ts'
import { exitCodeOf, finalPaths } from '../_support/paths.ts'

const ARGV_FOR_PATH: Record<string, string[]> = {
  HELP: ['--help'],
  VERSION: ['--version'],
  UNKNOWN_COMMAND: ['no-such-command'],
  'KNOWN_COMMAND TASK_SUCCEEDED': ['diagram', '--json'],
  'KNOWN_COMMAND TASK_FAILED': ['scrape', '--url', 'not a url'],
}

const paths = finalPaths(cliDispatchMachine, [
  'HELP',
  'VERSION',
  'UNKNOWN_COMMAND',
  'KNOWN_COMMAND',
  'TASK_SUCCEEDED',
  'TASK_FAILED',
])

describe('CLI dispatch machine matches bin/webular.ts', () => {
  test('the model has one scenario per path', () => {
    expect(paths.map((p) => p.events.join(' ')).sort()).toEqual(Object.keys(ARGV_FOR_PATH).sort())
  })

  test.each(paths.map((p) => [p.final, p] as const))(
    '%s',
    async (_name, path) => {
      const argv = ARGV_FOR_PATH[path.events.join(' ')] ?? []
      const { code } = await runCli('bin/webular.ts', argv)
      expect(code).toBe(exitCodeOf(path))
    },
    60_000,
  )
})
