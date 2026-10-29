// Guard: the home page and the docs read the same built tokens, site/src/tokens.css
// for type, space, and motion and site/src/semantic.css for light and dark colors,
// both built from site/design/tokens.json, so a token change restyles both and
// the two never drift apart.

import { expect, test } from 'bun:test'
import { Effect, FileSystem, Schema } from 'effect'
import { read } from '../_support/repo-files.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

test(
  'home and docs import the same built token files',
  eff(
    Effect.gen(function* () {
      const home = yield* read('site/src/Base.astro')
      const docs = yield* read('site-docs/app/global.css')
      const tokens = yield* read('site/src/tokens.css')
      expect(home).toContain("import './tokens.css'")
      expect(home).toContain("import './semantic.css'")
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

const Colors = Schema.Record(Schema.String, Schema.Struct({ $value: Schema.String }))
const Semantic = Schema.fromJsonString(
  Schema.Struct({
    primitive: Schema.Struct({ palette: Colors }),
    semantic: Schema.Struct({ light: Colors, dark: Colors }),
  }),
)
type Semantic = typeof Semantic.Type

// The declaration each semantic token should build to, with its palette alias resolved
// and its hex in lowercase, as Biome writes it.
const expected = (tokens: Semantic, mode: 'light' | 'dark') =>
  Object.entries(tokens.semantic[mode]).map(([name, leaf]) => {
    const alias = /^\{primitive\.palette\.(.+)\}$/.exec(leaf.$value)?.[1] ?? ''
    const value = tokens.primitive.palette[alias]?.$value ?? leaf.$value
    return `--semantic-${name}: ${value.toLowerCase()};`
  })

test(
  'home and docs get every semantic light and dark color from tokens.json',
  eff(
    Effect.gen(function* () {
      const tokens = yield* Schema.decodeUnknownEffect(Semantic)(
        yield* read('site/design/tokens.json'),
      )
      const built = yield* read('site/src/semantic.css')
      const docs = yield* read('site-docs/app/global.css')
      // Light sits on :root; dark sits under the system query and under the toggle's data-theme.
      const [light = '', systemDark = '', toggleDark = ''] = built.split(
        /@media \(prefers-color-scheme: dark\)|:root\[data-theme="dark"\]/,
      )
      expect(systemDark).toContain(':root:not([data-theme="light"])')
      for (const line of expected(tokens, 'light')) expect(light).toContain(line)
      for (const line of expected(tokens, 'dark')) {
        expect(systemDark).toContain(line)
        expect(toggleDark).toContain(line)
      }
      // Every Fumadocs color reads a semantic token, so the docs follow both themes.
      expect(docs).toContain('@import "../../site/src/semantic.css";')
      const fd = docs.match(/--color-fd-[\w-]+: [^;]+;/g) ?? []
      expect(fd.length).toBeGreaterThan(10)
      expect(fd.filter((line) => !line.includes('var(--semantic-'))).toEqual([])
    }),
  ),
)

// Each --theme-* color in tokens.css and the semantic token that holds its role.
// Light values match one for one; in dark, text and muted take the ink (#ffd400)
// and surface takes the card (#22242a), the same colors the docs use.
const SEMANTIC_FOR_THEME: Readonly<Record<string, string>> = {
  '--theme-bg': '--semantic-page',
  '--theme-on-accent': '--semantic-page',
  '--theme-on-brand': '--semantic-page',
  '--theme-text': '--semantic-ink',
  '--theme-accent': '--semantic-ink',
  '--theme-brand': '--semantic-ink',
  '--theme-focus': '--semantic-ink',
  '--theme-muted': '--semantic-ink',
  '--theme-border': '--semantic-strand',
  '--theme-surface': '--semantic-card',
}

test(
  'no site page reads a --theme-* color that has a semantic token',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const tokens = yield* read('site/src/tokens.css')
      const semantic = yield* read('site/src/semantic.css')
      for (const [theme, token] of Object.entries(SEMANTIC_FOR_THEME)) {
        expect(tokens).toContain(`${theme}:`)
        expect(semantic).toContain(`${token}:`)
      }
      // tokens.css defines the --theme-* names; every other page file only reads colors.
      const files = (yield* fs.readDirectory(`${ROOT}site/src`, { recursive: true }))
        .map((file) => file.replaceAll('\\', '/'))
        .filter((file) => /\.(css|astro)$/.test(file) && file !== 'tokens.css')
      expect(files).toContain('site.css')
      const hits: Array<string> = []
      for (const file of files) {
        const text = yield* read(`site/src/${file}`)
        for (const [name] of text.matchAll(/--theme-[\w-]+/g))
          if (name in SEMANTIC_FOR_THEME) hits.push(`${file}: ${name}`)
      }
      expect(hits).toEqual([])
    }),
  ),
)
