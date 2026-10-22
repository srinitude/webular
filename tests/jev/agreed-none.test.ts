// A `none` pick that both option orders agree on at the bar reaches the readers
// that act on it (an empty field, no command, no click) instead of the fallback.
import { expect, test } from 'bun:test'
import { actDecision } from '../../src/lib/jev/decisions/act.ts'
import { suggestDecision } from '../../src/lib/jev/decisions/cli-suggest.ts'
import { fieldDecision } from '../../src/lib/jev/decisions/extract.ts'
import { agreedPick, CONFIDENCE_BAR, SWAPPED } from '../../src/lib/jev/payload/index.ts'

const sureNone = (key: string) => ({
  [key]: { choice: 'none', confidence: 0.99 },
  [`${key}${SWAPPED}`]: { choice: 'none', confidence: 0.99 },
})

test('agreedPick keeps `none` out by default', () => {
  expect(agreedPick(sureNone('k'), 'k', CONFIDENCE_BAR)).toBeUndefined()
})

test('extract.field reads an agreed none as an empty field', () => {
  const d = fieldDecision.def
  expect(d.read(sureNone('field') as never, CONFIDENCE_BAR, d.sample())).toBe('')
})

test('cli.suggest reads an agreed none as no command', () => {
  const d = suggestDecision.def
  expect(d.read(sureNone('command') as never, CONFIDENCE_BAR, d.sample())).toBeNull()
})

test('act.next reads an agreed none as do nothing', () => {
  const d = actDecision.def
  expect(d.read(sureNone('next') as never, CONFIDENCE_BAR, d.sample())).toBe('none')
})
