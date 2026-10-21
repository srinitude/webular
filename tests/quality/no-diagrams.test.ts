// Guard: docs/diagrams and Mermaid diagrams are gone for good. The XState
// machines in src/machines/ replace them; this fails if any diagram returns.

import { describe, expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const repoFiles = runProc(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], {
  timeoutMs: 10_000,
  cwd: ROOT,
}).pipe(Effect.map(({ stdout }) => stdout.split('\n')))

describe('no diagram docs come back', () => {
  test(
    'docs/diagrams does not exist',
    eff(
      Effect.gen(function* () {
        expect(yield* (yield* FileSystem.FileSystem).exists(`${ROOT}docs/diagrams`)).toBe(false)
      }),
    ),
  )

  test(
    'no Mermaid source anywhere in the repo',
    eff(
      Effect.gen(function* () {
        const files = yield* repoFiles
        expect(files.filter((f) => /\.(mmd|mermaid)$/.test(f))).toEqual([])
      }),
    ),
  )

  test(
    'no SVG under docs/',
    eff(
      Effect.gen(function* () {
        const files = yield* repoFiles
        expect(files.filter((f) => f.startsWith('docs/') && f.endsWith('.svg'))).toEqual([])
      }),
    ),
  )
})
