// PDF text fidelity: a report-style PDF with a running header, "Page N of M"
// footers, and words hyphenated across line ends must parse to its body text.
// Score = 1 - word-level edit distance / gold length (Bast & Korzen, JCDL 2017,
// count headers, footers, and split hyphenated words as extraction errors).
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { pdfText } from '../../src/lib/parse.ts'
import { linesPdf } from '../_support/pdf-fixture.ts'
import { eff } from '../_support/run.ts'
import { scoreboardValue } from '../_support/scoreboard.ts'

const BODY = [
  [
    'Revenue grew in every region this year, led by strong de-',
    'mand for state-of-the-art storage and a steady renewal rate.',
  ],
  [
    'Operating costs fell as the team finished the migra-',
    'tion to shared infrastructure and closed two old offices.',
  ],
  [
    'Headcount stayed flat while support response times im-',
    'proved by a third across all customer tiers.',
  ],
  [
    'The board approved a modest dividend and a new invest-',
    'ment plan for research in the coming fiscal period.',
  ],
]
const pages = BODY.map((body, i) => [
  'Acme Corp Annual Report',
  ...body,
  `Page ${i + 1} of ${BODY.length}`,
])
const gold = BODY.map(([a = '', b = '']) => `${a.slice(0, -1)}${b}`).join(' ')

const words = (s: string) => s.split(/\s+/).filter(Boolean)
const editDistance = (a: string[], b: string[]) => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    prev = cur
  }
  return prev[b.length] ?? 0
}
const fidelity = (out: string, ref: string) => {
  const [o, r] = [words(out), words(ref)]
  return 1 - editDistance(o, r) / Math.max(o.length, r.length)
}

test(
  'report PDF parses to its body text (fidelity >= 0.95)',
  eff(
    Effect.gen(function* () {
      const bytes = linesPdf(pages)
      const out = yield* pdfText(bytes)
      const t0 = performance.now()
      for (let i = 0; i < 10; i++) yield* pdfText(bytes)
      const ms = (performance.now() - t0) / 10
      const score = fidelity(out, gold)
      console.log(`pdf fidelity ${score.toFixed(3)} avg ${ms.toFixed(2)} ms`)
      expect(score).toBeGreaterThanOrEqual(0.95)
      expect(Number(score.toFixed(4))).toBe(scoreboardValue('parse', 'accuracy') ?? -1)
    }),
  ),
  30_000,
)
