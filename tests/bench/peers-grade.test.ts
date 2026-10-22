import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { type Calibration, calibrate } from '../../scripts/bench/judge.ts'
import {
  answerAccuracy,
  answerField,
  blindForJudge,
  judgedAccuracy,
} from '../../scripts/bench/peers/grade.ts'
import type { Task } from '../../scripts/bench/peers/model.ts'
import type { JudgeLabel } from '../../scripts/bench/schema.ts'

const task = {
  id: 'capital',
  job: 'answer',
  suite: 'test',
  input: { query: 'capital of France?' },
  checks: [{ kind: 'contains', values: ['Paris'] }],
  answers: ['Paris'],
} as unknown as Task

const out = (text: string) => ({ text, urls: [] })

describe('length-normalized containment', () => {
  test('reads the answer from JSON or an Answer: line', () => {
    expect(answerField('{"answer":"Paris"}')).toBe('Paris')
    expect(answerField('Notes here.\nFinal answer: Paris\nmore')).toBe('Paris')
    expect(answerField('Paris is a city')).toBeUndefined()
  })

  test('a long list that names the gold elsewhere earns nothing', () => {
    const dump = `Answer: Lyon\nOther candidates: Marseille, Paris, Nice, ${'filler '.repeat(500)}`
    expect(answerAccuracy(task, out(dump))).toBe(0)
    expect(answerAccuracy(task, out('Answer: Paris'))).toBe(1)
  })

  test('no answer field means a containment check cannot pass on a search job', () => {
    expect(answerAccuracy({ ...task, job: 'search' }, out('Paris'))).toBe(0)
  })

  test('an answer job is graded on a bare answer string, the same for every provider', () => {
    expect(answerAccuracy(task, out('The capital of France is Paris.'))).toBe(1)
    expect(answerAccuracy(task, out('The capital of France is Lyon.'))).toBe(0)
  })
})

describe('judge blinding', () => {
  test('strips tool and provider names, any case', () => {
    const blind = blindForJudge('Per Exa and FIRECRAWL, webular says Paris', [
      'exa',
      'firecrawl',
      'webular',
    ])
    expect(blind).toBe('Per [tool] and [tool], [tool] says Paris')
  })
})

describe('judge kappa gate', () => {
  const judge = (label: JudgeLabel) => ({
    model: 'pinned-judge',
    judge: () => Effect.succeed(label),
  })
  const run = (cal: Calibration, label: JudgeLabel, text: string) =>
    Effect.runSync(
      judgedAccuracy({ judge: judge(label), calibration: cal, names: ['exa'] }, task, out(text)),
    )
  const good: Calibration = { n: 200, kappa: 0.85, accuracy: 0.96, flipRate: 0.01 }
  const weak: Calibration = { n: 200, kappa: 0.79, accuracy: 0.96, flipRate: 0 }

  test('a calibrated judge decides', () => {
    expect(run(good, 'correct', 'Paris')).toBe(1)
    expect(run(good, 'incorrect', 'Answer: Paris')).toBe(0)
  })

  test('kappa under 0.8 falls back to containment', () => {
    expect(run(weak, 'correct', 'Lyon')).toBe(0)
    expect(run(weak, 'incorrect', 'Answer: Paris')).toBe(1)
  })

  test('a judge that flips 2% or more of labels on swapped order falls back to containment', () => {
    const human: JudgeLabel[] = ['correct', 'incorrect', 'correct', 'not_attempted']
    const swapped: JudgeLabel[] = ['correct', 'incorrect', 'incorrect', 'not_attempted']
    expect(calibrate(human, human, swapped).flipRate).toBe(0.25)
    expect(calibrate(human, human, human)).toEqual({ n: 4, kappa: 1, accuracy: 1, flipRate: 0 })
    expect(run({ ...good, flipRate: 0.02 }, 'incorrect', 'Answer: Paris')).toBe(1)
  })

  test('no judge configured falls back to containment', () => {
    const setup = { judge: undefined, calibration: undefined, names: [] }
    expect(Effect.runSync(judgedAccuracy(setup, task, out('Answer: Paris')))).toBe(1)
  })
})
