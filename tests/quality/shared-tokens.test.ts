// Guard: the home page and the docs read one token source, site/src/tokens.css,
// built from site/design/tokens.json, so a token change restyles both and the
// two never drift apart.

import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { read } from '../_support/repo-files.ts'
import { eff } from '../_support/run.ts'

test(
  'home and docs import the same built token file',
  eff(
    Effect.gen(function* () {
      const home = yield* read('site/src/Base.astro')
      const docs = yield* read('site-docs/app/global.css')
      const tokens = yield* read('site/src/tokens.css')
      expect(home).toContain("import './tokens.css'")
      expect(docs).toContain('@import "../../site/src/tokens.css";')
      // The docs theme maps its colors, type, and spacing onto these names.
      for (const name of ['--theme-bg', '--theme-accent', '--font-sans', '--space-4'])
        expect(tokens).toContain(`${name}:`)
    }),
  ),
)

test(
  'docs type sizes, weights, and transition motion read tokens, not Tailwind defaults',
  eff(
    Effect.gen(function* () {
      const docs = yield* read('site-docs/app/global.css')
      const tokens = yield* read('site/src/tokens.css')
      // Same-named steps come straight from tokens.css, unlayered over Tailwind's theme layer.
      for (const name of [
        '--text-xs',
        '--text-sm',
        '--text-lg',
        '--font-weight-medium',
        '--font-weight-bold',
      ])
        expect(tokens).toContain(`${name}:`)
      const mapped: ReadonlyArray<readonly [string, string]> = [
        ['--text-base', '--text-md'],
        ['--text-2xl', '--text-xl'],
        ['--text-6xl', '--text-3xl'],
        ['--font-weight-semibold', '--font-weight-bold'],
        ['--default-transition-duration', '--motion-quick'],
      ]
      for (const [theme, token] of mapped) {
        expect(docs).toContain(`${theme}: var(${token});`)
        expect(tokens).toContain(`${token}:`)
      }
    }),
  ),
)
