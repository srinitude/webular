// Contract: bench case markers in the Jev log tag every following row with its case.
import { expect, test } from 'bun:test'
import { joinCases } from '../../scripts/bench/peers/cases.ts'

test('each Jev row takes the case of the marker before it; markers drop out', () => {
  const rows = [
    { decision: 'answer.hits' },
    { decision: 'bench.case', case: 'qa#1' },
    { decision: 'answer.hits' },
    { decision: 'answer.sentence' },
    { decision: 'bench.case', case: 'qa#2' },
    { decision: 'answer.hits' },
  ]
  expect(joinCases(rows).map((r) => [r.decision, r.case])).toEqual([
    ['answer.hits', undefined],
    ['answer.hits', 'qa#1'],
    ['answer.sentence', 'qa#1'],
    ['answer.hits', 'qa#2'],
  ])
})
