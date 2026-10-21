// The summarize.core follow-up swaps sure filler picks for sure core sentences, never changing the count.
import { expect, test } from 'bun:test'
import { followUp } from '../../src/lib/jev/decisions/summary-follow-up.ts'

test('sure filler picks give way to sure core sentences; too few keeps the picks', () => {
  expect(followUp([0, 2], ['filler', 'core', 'unsure'])).toEqual([1, 2])
  expect(followUp([0, 2], ['filler', 'unsure', 'filler'])).toEqual([0, 2])
  expect(followUp([0], ['unsure', 'core'])).toEqual([0])
})
