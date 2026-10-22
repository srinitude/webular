import { expect, test } from 'bun:test'
import { seedTasks } from './generate-answer-seed.ts'

const tasks = seedTasks()
const noAnswer = tasks.filter((t) => t.questionType === 'answer.no-answer')
const ambiguous = tasks.filter((t) => t.tags['ambiguous'] === true)

test('seed adds at least 8 no-answer and 6 ambiguous tasks', () => {
  expect(noAnswer.length).toBeGreaterThanOrEqual(8)
  expect(ambiguous.length).toBeGreaterThanOrEqual(6)
})

test('every seed task has a source, a quoted span, and aliases', () => {
  for (const t of tasks) {
    expect(t.source.url.startsWith('https://')).toBe(true)
    expect(t.source.url.includes('wikidata.org')).toBe(false)
    expect(t.source.license.length).toBeGreaterThan(0)
    expect(t.aliases.length).toBeGreaterThan(0)
    const evidence = t.gold['evidence'] as ReadonlyArray<{ span: string }>
    expect(evidence.length).toBeGreaterThan(0)
  }
})

test('ambiguous seed tasks accept at least two answers; no-answer tasks accept none', () => {
  for (const t of ambiguous)
    expect((t.gold['answers'] as ReadonlyArray<string>).length).toBeGreaterThan(1)
  for (const t of noAnswer) expect(t.gold['answers']).toEqual([])
})

test('seed ids are unique', () => {
  expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length)
})
