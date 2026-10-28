// Guard: the home page and the docs read one token source, site/design/hero-tokens.css,
// so a token change restyles both and the two never drift apart.

import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { read } from '../_support/repo-files.ts'
import { eff } from '../_support/run.ts'

test(
  'home and docs import the same hero token file',
  eff(
    Effect.gen(function* () {
      const home = yield* read('site/src/Base.astro')
      const docs = yield* read('site-docs/app/global.css')
      const tokens = yield* read('site/design/hero-tokens.css')
      expect(home).toContain("import '../design/hero-tokens.css'")
      expect(docs).toContain('@import "../../site/design/hero-tokens.css";')
      // The docs theme maps its colors, type, and spacing onto these names.
      for (const name of [
        '--semantic-color-surface-page',
        '--semantic-color-text-accent',
        '--primitive-font-family-serif',
        '--semantic-space-1',
      ])
        expect(tokens).toContain(`${name}:`)
    }),
  ),
)
