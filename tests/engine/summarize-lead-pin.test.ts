// Jev's agreed lead survives MMR: when the lead is already a frequency pick, the
// decision returns the frequency picks unchanged, so the workflow re-ranks with MMR
// and must keep that lead pinned.
import { expect, test } from 'bun:test'
import { topIndexes } from '../../src/lib/jev/decisions/summarize.ts'
import { rankSpans, sentenceSpans } from '../../src/lib/summarize-rank.ts'
import { result } from '../../src/workflows/summarize.ts'

const PAGE = [
  'Bun ships a fast SQLite driver built into the runtime.',
  'Bun ships a fast SQLite driver built into the runtime today.',
  'The driver runs prepared statements and returns plain objects.',
  'Bun also bundles a test runner that reads Jest style files.',
  'Thanks for reading!',
].join(' ')
const LEAD = 1

test('a lead that is a frequency pick stays when MMR re-ranks', () => {
  const picks = topIndexes(PAGE, 2)
  expect(picks).toContain(LEAD)
  expect(rankSpans(PAGE, 2).map((s) => s.index)).not.toContain(LEAD)
  const r = { text: PAGE, sentences: 2, source_url: null, all: sentenceSpans(PAGE) }
  const out = result(r, { picks, lead: LEAD })
  expect(out.picks.map((p) => p.index)).toContain(LEAD)
  expect(out.picks).toHaveLength(2)
})
