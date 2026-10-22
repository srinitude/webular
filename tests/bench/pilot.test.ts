// Image pilot: the sure-but-wrong scorer, the keep rule, and a dry run that
// loads the pilot task file and finds every task's license in SOURCES.md.
// No model or network call runs here.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { loadSetFile } from '../../scripts/bench/loader.ts'
import {
  type ArmScore,
  isSureButWrong,
  keepFailures,
  type PilotResult,
  SURE_CONFIDENCE,
  scoreArm,
} from '../../scripts/bench/pilot.ts'
import { graded } from '../../scripts/bench/pilot-io.ts'
import { eff } from '../_support/run.ts'

const DIR = `${import.meta.dir}/../../bench/tasks`
const row = (correct: boolean, confidence: number, arm: PilotResult['arm'] = 'image') => ({
  arm,
  correct,
  confidence,
  usd: 0.01,
})

test('a wrong answer counts as sure-but-wrong only at high confidence', () => {
  expect(isSureButWrong(row(false, SURE_CONFIDENCE))).toBe(true)
  expect(isSureButWrong(row(false, 0.95))).toBe(true)
  expect(isSureButWrong(row(false, 0.3))).toBe(false)
  expect(isSureButWrong(row(true, 0.99))).toBe(false)
})

test('a reply is correct when it holds the gold answer or an alias', () => {
  expect(graded('About 18.4 percent', ['18.4'])).toBe(true)
  expect(graded('1,865', ['1865'])).toBe(true)
  expect(graded('mol/mol', ['ppm', 'mol/mol'])).toBe(true)
  expect(graded('1880', ['1865'])).toBe(false)
  expect(graded('', [''])).toBe(false)
})

test('each arm is scored on its own rows', () => {
  const results = [row(true, 0.9), row(false, 0.9), row(false, 0.2), row(true, 0.9, 'text-only')]
  expect(scoreArm('image', results)).toEqual({
    passRate: 1 / 3,
    usdPerSuccess: 0.03,
    sureButWrongRate: 0.5,
  })
  expect(scoreArm('text-only', results).passRate).toBe(1)
})

test('the keep rule needs pass rate held, cost per success down, sure-but-wrong not up', () => {
  const base: ArmScore = { passRate: 0.5, usdPerSuccess: 0.1, sureButWrongRate: 0.2 }
  expect(keepFailures(base, { passRate: 0.5, usdPerSuccess: 0.09, sureButWrongRate: 0.2 })).toEqual(
    [],
  )
  const worse = keepFailures(base, { passRate: 0.4, usdPerSuccess: 0.1, sureButWrongRate: 0.3 })
  expect(worse.map((f) => f.split(' ')[0])).toEqual([
    'passRate',
    'usdPerSuccess',
    'sureButWrongRate',
  ])
})

test(
  'dry run: pilot tasks load and every task URL has a license entry in SOURCES.md',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const { tasks } = yield* loadSetFile(DIR, 'dev/pilot-images.jsonl')
      const sources = yield* fs.readFileString(`${DIR}/SOURCES.md`)
      expect(tasks.length).toBeGreaterThan(0)
      for (const t of tasks) {
        const line = sources.split('\n').find((l) => l.startsWith(`| ${t.id} |`)) ?? ''
        expect(line).toContain(`<${t.source.url}>`)
        expect(line).toContain(`| ${t.source.license} |`)
      }
    }),
  ),
)
