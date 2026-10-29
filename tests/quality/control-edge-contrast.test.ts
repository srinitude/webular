// Guard: every color that draws the only visible edge of a control (button, copy
// button, tab, theme switch, search box, focus ring) keeps 3:1 against the page and
// the card it sits on, in light and dark, as WCAG `2.2` SC `1.4.11` asks
// (https://www.w3.org/TR/WCAG22/#non-text-contrast). The docs theme switch marks its
// selected item with the edge token, since the Fumadocs 8% accent fill alone is near 1:1.

import { expect, test } from 'bun:test'
import { Console, Effect, Schema } from 'effect'
import { read } from '../_support/repo-files.ts'
import { eff } from '../_support/run.ts'

const Colors = Schema.Record(Schema.String, Schema.Struct({ $value: Schema.String }))
const Tokens = Schema.fromJsonString(
  Schema.Struct({
    primitive: Schema.Struct({ palette: Colors }),
    semantic: Schema.Struct({ light: Colors, dark: Colors }),
  }),
)
type Tokens = typeof Tokens.Type
type Mode = 'light' | 'dark'

// WCAG relative luminance and contrast ratio.
const luminance = (hex: string) => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// A semantic color with its {primitive.palette.<name>} alias resolved.
const color = (tokens: Tokens, mode: Mode, name: string) => {
  const raw = tokens.semantic[mode][name]?.$value ?? ''
  const alias = /^\{primitive\.palette\.([\w-]+)\}$/.exec(raw)?.[1]
  return alias === undefined ? raw : (tokens.primitive.palette[alias]?.$value ?? '')
}

// Tokens that draw a control edge, and the backgrounds those controls sit on.
const PAIRS = (['light', 'dark'] as const).flatMap((mode) =>
  ['edge', 'strand', 'ink'].flatMap((edge) => ['page', 'card'].map((bg) => ({ mode, edge, bg }))),
)

test(
  'every control edge token keeps 3:1 against page and card in both themes',
  eff(
    Effect.gen(function* () {
      const tokens = yield* Schema.decodeUnknownEffect(Tokens)(
        yield* read('site/design/tokens.json'),
      )
      const rows = PAIRS.map(({ mode, edge, bg }) => ({
        label: `${mode} ${edge} on ${bg}`,
        value: ratio(color(tokens, mode, edge), color(tokens, mode, bg)),
      }))
      yield* Console.log(rows.map((row) => `${row.label}: ${row.value.toFixed(2)}:1`).join('\n'))
      expect(rows.filter((row) => !(row.value >= 3)).map((row) => row.label)).toEqual([])
    }),
  ),
)

test(
  'the docs theme switch marks its selected item with the edge token',
  eff(
    Effect.gen(function* () {
      const docs = yield* read('site-docs/app/global.css')
      const semantic = yield* read('site/src/semantic.css')
      expect(semantic).toContain('--semantic-edge:')
      expect(docs).toMatch(/\[data-theme-toggle\] \.bg-fd-accent \{[^}]*var\(--semantic-edge\)/)
    }),
  ),
)
