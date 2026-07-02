// Enforces the project's structural rules across the whole codebase
// (verifymethod: test for requirement R2 — see docs/diagrams/06-requirement.mmd).
import { describe, expect, test } from 'bun:test'
import { analyzeFile, listFiles } from '../_support/limits.ts'

import { ROOT as REPO_ROOT } from '../_support/root.ts'

const ROOT = REPO_ROOT.replace(/\/$/, '')
const files = listFiles(ROOT)

describe('code limits — 200 lines/file, 30/construct, nesting depth <= 3', () => {
  test('there are TypeScript sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  test('every source, bin and test file complies', () => {
    const violations = files.flatMap((f) => analyzeFile(f, f.slice(ROOT.length + 1)))
    if (violations.length > 0) {
      console.error(violations.map((v) => `${v.file}: [${v.kind}] ${v.detail}`).join('\n'))
    }
    expect(violations).toEqual([])
  })
})
