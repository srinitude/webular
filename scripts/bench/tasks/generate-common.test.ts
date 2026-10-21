import { expect, test } from 'bun:test'
import { AUTHOR, assignSplits, BUILD_DATE, CANARY, type Task } from './generate-common.ts'

const task = (id: string, family: string): Task => ({
  id,
  family,
  input: { query: id },
  gold: {},
  aliases: [],
  source: { url: 'https://www.wikidata.org/', asOf: BUILD_DATE, license: 'CC0-1.0' },
  author: AUTHOR,
  buildDate: BUILD_DATE,
  questionType: 'factoid',
  tags: { domain: 'science', language: 'en', fresh: false, longTail: false },
  canary: CANARY,
})

test('each family holds out exactly 30% private and splits the rest evenly', () => {
  const tasks = [
    ...Array.from({ length: 100 }, (_, i) => task(`a${i}`, 'answer')),
    ...Array.from({ length: 30 }, (_, i) => task(`c${i}`, 'crawl')),
  ]
  const out = assignSplits(tasks)
  const count = (family: string, split: string) =>
    out.filter((t) => t.family === family && t.split === split).length
  expect([count('answer', 'private'), count('answer', 'dev'), count('answer', 'test')]).toEqual([
    30, 35, 35,
  ])
  expect([count('crawl', 'private'), count('crawl', 'dev'), count('crawl', 'test')]).toEqual([
    9, 11, 10,
  ])
})

test('splits are stable across input order', () => {
  const tasks = Array.from({ length: 20 }, (_, i) => task(`t${i}`, 'search'))
  const key = (ts: ReadonlyArray<Task>) =>
    ts
      .map((t) => `${t.id}:${t.split}`)
      .sort()
      .join(',')
  expect(key(assignSplits(tasks))).toBe(key(assignSplits([...tasks].reverse())))
})
