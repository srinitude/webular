// Enforces the project's structural rules across the whole codebase
// (requirement R2: 200 lines per file, 30 per construct, nesting depth 3).
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { analyzeFile, listFiles } from '../_support/limits.ts'
import { ROOT as REPO_ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const ROOT = REPO_ROOT.replace(/\/$/, '')

describe('code limits — 200 lines/file, 30/construct, nesting depth <= 3', () => {
  test(
    'there are TypeScript sources to check',
    eff(
      Effect.gen(function* () {
        expect((yield* listFiles(ROOT)).length).toBeGreaterThan(0)
      }),
    ),
  )

  test(
    'every source, bin and test file complies',
    eff(
      Effect.gen(function* () {
        const files = yield* listFiles(ROOT)
        const found = yield* Effect.forEach(
          files,
          (f) => analyzeFile(f, f.slice(ROOT.length + 1)),
          {
            concurrency: 8,
          },
        )
        const violations = found.flat()
        if (violations.length > 0) {
          console.error(violations.map((v) => `${v.file}: [${v.kind}] ${v.detail}`).join('\n'))
        }
        expect(violations).toEqual([])
      }),
    ),
  )
})
