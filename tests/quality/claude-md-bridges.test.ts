// Guard: each AGENTS.md has a CLAUDE.md beside it that holds only `@AGENTS.md`,
// as a real file, so Claude Code loads the folder's rules.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { read } from '../_support/repo-files.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

// `git ls-files -s` gives mode, blob, stage, and path; mode 120000 is a symlink.
const staged = runProc(['git', 'ls-files', '-s', '--', '*AGENTS.md', '*CLAUDE.md'], {
  timeoutMs: 10_000,
  cwd: ROOT,
}).pipe(Effect.map(({ stdout }) => stdout.split('\n').filter(Boolean)))

const bridgeProblems = (rows: ReadonlyArray<string>) => {
  const mode = new Map(rows.map((r) => [r.split('\t')[1] ?? '', r.split(' ')[0] ?? '']))
  const dirs = [...mode.keys()].filter((p) => p.endsWith('AGENTS.md')).map((p) => p.slice(0, -9))
  return dirs.flatMap((dir) => {
    const bridge = `${dir}CLAUDE.md`
    if (!mode.has(bridge)) return [`${bridge}: missing`]
    return mode.get(bridge) === '120000' ? [`${bridge}: a symlink, not a file`] : []
  })
}

const contentProblems = (rows: ReadonlyArray<string>) =>
  Effect.forEach(
    rows.map((r) => r.split('\t')[1] ?? '').filter((p) => p.endsWith('CLAUDE.md')),
    (p) =>
      Effect.map(read(p), (text) =>
        text.trim() === '@AGENTS.md' ? [] : [`${p}: holds more than @AGENTS.md`],
      ),
    { concurrency: 8 },
  )

describe('CLAUDE.md bridges', () => {
  test(
    'each AGENTS.md has a real CLAUDE.md beside it that imports it',
    eff(
      Effect.gen(function* () {
        const rows = yield* staged
        const content = yield* contentProblems(rows)
        expect([...bridgeProblems(rows), ...content.flat()]).toEqual([])
      }),
    ),
    30_000,
  )

  test('a missing bridge and a symlink are caught', () => {
    const rows = ['100644 a 0\tsrc/AGENTS.md', '100644 b 0\tx/AGENTS.md', '120000 c 0\tx/CLAUDE.md']
    expect(bridgeProblems(rows)).toEqual([
      'src/CLAUDE.md: missing',
      'x/CLAUDE.md: a symlink, not a file',
    ])
  })
})
