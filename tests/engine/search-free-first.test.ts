// Free sources first: the keyless APIs run at once and DuckDuckGo (`web`) runs only when none
// of them returned hits. Counts calls per source and checks web comes after every free source.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { pickSources, type SourceRunner, searchEffect } from '../../src/lib/search-chain.ts'
import { eff } from '../_support/run.ts'

type Hit = { title: string; url: string; description: string }
const hit = (url: string): Hit => ({ title: url, url, description: '' })

const effectTest =
  <A, E>(body: () => Generator<Effect.Effect<unknown, E>, A>) =>
  () =>
    eff(Effect.gen(body))()

// Records `source` per call, in order; every free source answers `free`, web answers `web`.
const counting =
  (free: Hit[], web: Hit[], calls: string[]): SourceRunner =>
  (source) => {
    calls.push(source)
    return Effect.succeed(source === 'web' ? web : free)
  }
const countOf = (calls: string[], source: string) => calls.filter((s) => s === source).length

function* freeHitsSkipDuckDuckGo() {
  const calls: string[] = []
  const { results } = yield* searchEffect('web', 'bun runtime', 10, {
    runSource: counting([hit('https://bun.sh/')], [hit('https://ddg.example/')], calls),
  })
  expect(countOf(calls, 'web')).toBe(0)
  for (const s of pickSources('bun runtime')) expect(countOf(calls, s)).toBe(1)
  expect(results.map((r) => r.url)).toEqual(['https://bun.sh/'])
}

function* emptyFreeSourcesFallToDuckDuckGo() {
  const calls: string[] = []
  const { results } = yield* searchEffect('web', 'bun runtime', 10, {
    runSource: counting([], [hit('https://ddg.example/')], calls),
  })
  expect(countOf(calls, 'web')).toBe(1)
  for (const s of pickSources('bun runtime')) expect(countOf(calls, s)).toBe(1)
  // DuckDuckGo is the last call: every free source was asked before it.
  expect(calls.at(-1)).toBe('web')
  expect(results.map((r) => r.url)).toEqual(['https://ddg.example/'])
}

test('free sources with hits keep DuckDuckGo from running', effectTest(freeHitsSkipDuckDuckGo))
test(
  'empty free sources send the search to DuckDuckGo last',
  effectTest(emptyFreeSourcesFallToDuckDuckGo),
)
