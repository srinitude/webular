// Bounded source fan-out (P5/B21/B22): entries keep INPUT order regardless of
// latency, failures surface as attempt-ordered errors, results are stable.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { fetchSources } from '../../src/lib/sources.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'

let fx: Fixture
beforeAll(() => {
  fx = startFixture(defaultRoutes)
})
afterAll(() => fx.stop())

describe('fetchSources — index-ordered bounded fan-out', () => {
  test('entries follow input order even when the first source is slowest', async () => {
    const sources = [
      { title: 'Slow', url: `${fx.origin}/slow?ms=120` },
      { title: 'Gamma', url: `${fx.origin}/c` },
      { title: 'Alpha', url: `${fx.origin}/a` },
    ]
    const { entries, errors } = await fetchSources(sources)
    expect(entries.map((e) => e.title)).toEqual(['Slow', 'Gamma', 'Alpha'])
    expect(entries.every((e) => e.text.length > 0)).toBe(true)
    expect(errors).toEqual([])
  }, 15_000)

  test('failed sources land in errors, not entries', async () => {
    const sources = [
      { title: 'Gamma', url: `${fx.origin}/c` },
      { title: 'Broken', url: `${fx.origin}/status?code=404` },
      { title: 'Alpha', url: `${fx.origin}/a` },
    ]
    const { entries, errors } = await fetchSources(sources)
    expect(entries.map((e) => e.title)).toEqual(['Gamma', 'Alpha'])
    expect(errors).toEqual([
      { url: `${fx.origin}/status?code=404`, reason: expect.stringContaining('404') },
    ])
  }, 15_000)

  test('two runs are deeply equal', async () => {
    const sources = [
      { title: 'A', url: `${fx.origin}/a` },
      { title: 'B', url: `${fx.origin}/b` },
    ]
    expect(await fetchSources(sources)).toEqual(await fetchSources(sources))
  }, 15_000)
})
