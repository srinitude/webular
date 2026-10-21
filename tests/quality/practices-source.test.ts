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
  'verbatimModuleSyntax',
  'isolatedModules',
  'erasableSyntaxOnly',
]

// ponytail: ratchet. Files still on zod 3 string formats; the Effect conversion
// removes them. A new offender or a fixed-but-still-listed file both fail.
const ZOD3_FORMAT_FILES = [
  'src/tools/web.ts',
  ...[
    'act',
    'batch',
    'crawl',
    'extract',
    'feed',
    'map',
    'media',
    'monitor',
    'scrape',
    'summarize',
  ].map((name) => `src/workflows/${name}.ts`),
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
  check('no ANSI color escapes, so no meaning rides on color alone', none(/\\x1b\[|\\u001b\[/))
  check(
    'no Effect 3 packages or beta-only Effect paths',
    none(/'(@effect\/(schema|cli|platform)'|effect\/unstable\/)|GenericTag/),
  )
  check('no XState v4 APIs', none(/\b(interpret|Machine)\(|withConfig\(|\.typegen/))
  check(
    'zod 4 top-level string formats, ratchet on known offenders',
    Effect.map(
      matching(/z\.string\(\)\.(url|email|uuid)\(\)|\.passthrough\(\)|z\.nativeEnum\(/),
      (found) => expect(found).toEqual([...ZOD3_FORMAT_FILES].sort()),
    ),
  )
})
