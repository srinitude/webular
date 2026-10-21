// Best-practices gate (docs/best-practices.md): compiler flags, docs, and
// source patterns a grep can decide.
import { describe, expect } from 'bun:test'
import { Effect } from 'effect'
import { fileChecks, matching, packageJson, read, tsconfig } from '../_support/repo-files.ts'

const check = fileChecks()

const STRICT_FLAGS = [
  'strict',
  'noUncheckedIndexedAccess',
  'noImplicitOverride',
  'noFallthroughCasesInSwitch',
  'noUnusedLocals',
  'exactOptionalPropertyTypes',
  'noPropertyAccessFromIndexSignature',
  'verbatimModuleSyntax',
  'isolatedModules',
  'erasableSyntaxOnly',
]

const none = (pattern: RegExp) =>
  Effect.map(matching(pattern), (found) => expect(found).toEqual([]))

describe('best practices: compiler and docs', () => {
  check(
    'tsconfig keeps the strict flag set',
    Effect.map(tsconfig, ({ compilerOptions }) => {
      for (const flag of STRICT_FLAGS) expect(compilerOptions[flag]).toBe(true)
    }),
  )
  check(
    'CHANGELOG.md has an entry for the package version; SECURITY.md exists',
    Effect.gen(function* () {
      const { version } = yield* packageJson
      expect(yield* read('CHANGELOG.md')).toContain(`## [${version}]`)
      expect(yield* read('SECURITY.md')).toContain('Reporting')
    }),
  )
  check(
    'README documents the exit codes the CLI uses',
    Effect.map(read('README.md'), (readme) => {
      for (const code of ['`0`', '`1`', '`2`', '`3`', '`127`']) expect(readme).toContain(code)
    }),
  )
})

describe('best practices: source patterns', () => {
  check(
    'ANSI color lives only in src/cli/style.ts, so no meaning rides on color alone',
    Effect.map(matching(/\\x1b\[|\\u001b\[/), (found) =>
      expect(found.filter((file) => !file.endsWith('src/cli/style.ts'))).toEqual([]),
    ),
  )
  check(
    'no Effect 3 packages or beta-only Effect paths',
    none(/'(@effect\/(schema|cli|platform)'|effect\/unstable\/)|GenericTag/),
  )
  check('no XState v4 APIs', none(/\b(interpret|Machine)\(|withConfig\(|\.typegen/))
  check(
    'zod 4 top-level string formats, no passthrough, no nativeEnum',
    none(/z\.string\(\)\.(url|email|uuid)\(\)|\.passthrough\(\)|z\.nativeEnum\(/),
  )
})
