// Contract: bench/results holds only what a generator, a test, or a ceiling reads.
// That is the peer run with the highest timestamp (its .json and .txt, picked by
// the rule the docs and scoreboard generators use), the agent-matrix run that
// pickModelsRun picks, and any run that bench/command-parity-ceilings.json cites as
// evidence. The pick runs at test time, so a run landing from another branch is kept.
// Every bench/datasets file must be named by code, tests, or mise.toml.
// Fix a failure by deleting each listed file with git rm.

import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { pickRun } from '../../scripts/bench/peers/docs.ts'
import { pickModelsRun } from '../../scripts/bench/peers/matrix.ts'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const git = (args: ReadonlyArray<string>) =>
  runProc(['git', ...args], { timeoutMs: 30_000, cwd: ROOT }).pipe(
    Effect.map(({ stdout }) => stdout.split('\n').filter(Boolean)),
  )

const CEILINGS = 'bench/command-parity-ceilings.json'
const DOCS = new Set(['AGENTS.md', 'CLAUDE.md'])
const stem = (n: string) => n.replace(/\.(json|txt|md)$/, '')

// Pure rule, so the planted-file case below needs no repo state.
const unneeded = (names: ReadonlyArray<string>, cited: string) => {
  const peers = pickRun(names.filter((n) => n.endsWith('.json')))
  const models = pickModelsRun(names)
  const keep = new Set([peers, models].flatMap((n) => (n ? [stem(n)] : [])))
  return names.filter((n) => !DOCS.has(n) && !keep.has(stem(n)) && !cited.includes(stem(n)))
}

test(
  'bench/results holds only the picked runs and the runs ceilings cite (fix: git rm the rest)',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const names = (yield* git(['ls-files', 'bench/results'])).map((p) =>
        p.slice('bench/results/'.length),
      )
      const hasCeilings = (yield* git(['ls-files', CEILINGS])).length > 0
      const cited = hasCeilings ? yield* fs.readFileString(`${ROOT}/${CEILINGS}`) : ''
      expect(unneeded(names, cited)).toEqual([])
    }),
  ),
)

test(
  'every bench/datasets file is named by code, tests, or mise.toml',
  eff(
    Effect.gen(function* () {
      const files = (yield* git(['ls-files', 'bench/datasets'])).filter((p) => !p.endsWith('.md'))
      const named = new Set(
        yield* git([
          'grep',
          '-ohE',
          '[A-Za-z0-9_.-]+\\.json',
          '--',
          'src',
          'scripts',
          'tests',
          'mise.toml',
          ':(exclude)tests/bench/bench-artifacts-minimal.test.ts',
        ]),
      )
      expect(files.filter((p) => !named.has(p.split('/').pop() ?? p))).toEqual([])
    }),
  ),
)

test('an older run, a stray file, and a cited run are judged correctly', () => {
  const names = [
    'AGENTS.md',
    'peers-2026-10-22T14-51-52-746Z.json',
    'peers-2026-10-22T14-51-52-746Z.txt',
    'peers-2026-10-22T13-13-46-776Z.json',
    'peers-2026-10-22T12-35-03-944Z.json',
    'models-2026-10-22-062400-merged.json',
    'models-2026-10-22-015700-1.json',
    'notes.json',
  ]
  expect(unneeded(names, '"peers-2026-10-22T12-35-03-944Z"')).toEqual([
    'peers-2026-10-22T13-13-46-776Z.json',
    'models-2026-10-22-015700-1.json',
    'notes.json',
  ])
})
