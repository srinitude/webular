// Eval, code scorers on recorded live source lists (no network, no mocks):
// trust order = on a factoid lookup the top fused hit comes from a stable
// source; source coverage = share of the top hits whose site has a known role.
import { expect, test } from 'bun:test'
import { isFactoid, rankHits } from '../../src/lib/search.ts'
import { hostRole } from '../../src/lib/sources/roles.ts'
import spain from '../fixtures/sources/capital-of-spain-lists.json'
import riddle from '../fixtures/wikipedia-uncertainty-riddle.json'

type Hit = { title: string; url: string; description: string }
const cases: ReadonlyArray<{ query: string; lists: Hit[][] }> = [
  { query: spain.query, lists: [spain.lists.hackernews, spain.lists.wikipedia] },
  { query: spain.query, lists: [spain.lists.wikipedia, spain.lists.hackernews] },
  {
    query: 'In which city was the physicist who formulated the uncertainty principle born?',
    lists: [riddle, spain.lists.hackernews],
  },
]

const trustOrder = (c: (typeof cases)[number]) =>
  !isFactoid(c.query) || hostRole(rankHits(c.lists, c.query)[0]?.url ?? '') === 'stable' ? 1 : 0

const TOP = 3
const sourceCoverage = (c: (typeof cases)[number]) =>
  rankHits(c.lists, c.query)
    .slice(0, TOP)
    .filter((h) => hostRole(h.url)).length / TOP

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

test('trust order scores 1 on every recorded factoid case', () => {
  expect(mean(cases.map(trustOrder))).toBe(1)
})

test('every top hit on the recorded cases comes from a source with a known role', () => {
  expect(mean(cases.map(sourceCoverage))).toBe(1)
})
