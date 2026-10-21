// Human terminal output (clig.dev, no-color.org): the color rule, a red error
// label, control-character escaping for web text, width wrap, and the
// "did you mean" lookup. Color only decorates; the words carry the meaning.
import { Config, Effect } from 'effect'

export interface ColorEnv {
  readonly noColor: string
  readonly forceColor: string
  readonly term: string
}

// NO_COLOR (any non-empty value) wins over FORCE_COLOR; FORCE_COLOR=0 means
// off. With neither set, color needs a terminal that is not TERM=dumb.
export function useColor(isTTY: boolean, env: ColorEnv): boolean {
  if (env.noColor !== '') return false
  if (env.forceColor !== '') return env.forceColor !== '0'
  return isTTY && env.term !== 'dumb'
}

const envVar = (name: string) => Config.String(name).pipe(Config.withDefault(''))
const colorEnv = Config.all({
  noColor: envVar('NO_COLOR'),
  forceColor: envVar('FORCE_COLOR'),
  term: envVar('TERM'),
})

// The "error:" label for stderr, red when the color rule allows it.
export const errorLabel: Effect.Effect<string> = Effect.gen(function* () {
  const env = yield* colorEnv
  return useColor(process.stderr.isTTY === true, env) ? '\x1b[31merror:\x1b[0m' : 'error:'
}).pipe(Effect.orElseSucceed(() => 'error:'))

// Control characters (C0, DEL, C1) except tab, newline, and the CR of a CRLF,
// plus the bidi overrides that reorder what a reader sees (CWE-150).
const UNSAFE = /(?![\t\n])(?!\r\n)\p{Cc}|[‪-‮⁦-⁩]/gu
const visible = (c: string): string => {
  const hex = (c.codePointAt(0) ?? 0).toString(16).padStart(2, '0')
  return hex.length === 2 ? `\\x${hex}` : `\\u{${hex}}`
}

// Web text is untrusted: show each unsafe character as a visible \xNN or \u{NNNN}.
export const safeText = (text: string): string => text.replace(UNSAFE, visible)

// Terminal width for wrapping; a pipe or file gets whole lines.
export const termWidth = (): number =>
  process.stdout.isTTY === true ? (process.stdout.columns ?? 80) : Number.POSITIVE_INFINITY

// A word wider than a row splits into row-sized pieces.
const pieces = (word: string, room: number): string[] =>
  word.length <= room ? [word] : (word.match(new RegExp(`.{1,${room}}`, 'gu')) ?? [word])

// Greedy word wrap: the first `indent` columns stay on the first row, and each
// later row starts with `indent` spaces.
export function wrap(line: string, indent: number, width: number): string {
  if (line.length <= width) return line
  const room = Math.max(width - indent, 20)
  const rows: string[] = []
  let row = ''
  const words = line.slice(indent).split(' ')
  for (const word of words.flatMap((w) => pieces(w, room))) {
    if (row !== '' && row.length + 1 + word.length > room) {
      rows.push(row)
      row = word
    } else row = row === '' ? word : `${row} ${word}`
  }
  rows.push(row)
  const pad = ' '.repeat(indent)
  return rows.map((r, i) => (i === 0 ? line.slice(0, indent) : pad) + r).join('\n')
}

// Levenshtein distance, two rows at a time.
export function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      const swap = (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      row[j] = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, swap)
    }
    prev = row
  }
  return prev[b.length] ?? 0
}

// The closest name: a prefix match first, else one within edit distance 2.
export function closest(word: string, names: readonly string[]): string | undefined {
  let best: string | undefined
  let bestScore = 3
  for (const name of names) {
    const score = name.startsWith(word) ? 0 : distance(word, name)
    if (score < bestScore) [best, bestScore] = [name, score]
  }
  return best
}
