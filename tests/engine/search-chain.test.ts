// Search chain contract: free sources run at once, per-source status meta, degraded and weak
// flags, variant fusion, the official-site boost, DuckDuckGo as the last fallback, and the
// answer-mode second hop. Sources are injected through runSource (recorded Crossref hits).
import { describe, expect, test } from 'bun:test'
import { Clock, Effect } from 'effect'
import { HttpStatusError } from '../../src/core/http-body.ts'
import {
  pickSources,
  type SearchOptions,
  type SourceRunner,
  searchEffect,
} from '../../src/lib/search-chain.ts'
import { mainEntity } from '../../src/lib/search-hop.ts'
import type { SearchSource } from '../../src/lib/sources-search.ts'
import { eff } from '../_support/run.ts'
import crossrefWorks from '../fixtures/crossref-works.json'

type Hit = { title: string; url: string; description: string }
const hit = (url: string, title = url): Hit => ({ title, url, description: '' })
const recorded: Hit[] = crossrefWorks.message.items.map((w) =>
  hit(w.URL, (w.title as string[] | undefined)?.[0] ?? ''),
)

const effectTest =
  <A, E>(body: () => Generator<Effect.Effect<unknown, E>, A>) =>
  () =>
    eff(Effect.gen(body))()
const search = (query: string, runSource: SourceRunner, opts: SearchOptions = {}, limit = 10) =>
  searchEffect('web', query, limit, { ...opts, runSource })
const elapsedSince = (t0: number) => Effect.map(Clock.currentTimeMillis, (t) => t - t0)

// Every source answers `lists[source]`, or the recorded hits when unset.
const bySource =
  (lists: Partial<Record<SearchSource, Hit[]>>, calls: string[] = []): SourceRunner =>
  (source, query) => {
    calls.push(`${source}:${query}`)
    return Effect.succeed(lists[source] ?? recorded)
  }
const onlyWiki = (wikipedia: Hit[]) => ({ wikipedia, hackernews: [], openalex: [] })
function* concurrentNotSummed() {
  const sources = pickSources('bun runtime')
  const slow: SourceRunner = () => Effect.as(Effect.sleep(300), recorded)
  const t0 = yield* Clock.currentTimeMillis
  const { meta } = yield* search('bun runtime', slow)
  expect(yield* elapsedSince(t0)).toBeLessThan(300 * sources.length - 200)
  expect(Object.keys(meta.sources)).toEqual(sources)
  for (const s of sources) expect(meta.sources[s]?.ms).toBeGreaterThanOrEqual(290)
}

const forbidden = new HttpStatusError({ url: 'u', status: 403, statusText: 'Forbidden' })
function* everyStatus() {
  const mixed: SourceRunner = (s) =>
    s === 'wikipedia'
      ? Effect.succeed(recorded)
      : s === 'hackernews'
        ? Effect.fail(forbidden)
        : Effect.never
  const { meta } = yield* search('bun runtime', mixed)
  expect(meta.sources['wikipedia']?.status).toBe('ok')
  expect(meta.sources['hackernews']?.status).toBe('blocked:403')
  expect(meta.sources['openalex']?.status).toBe('timeout')
  const failing: SourceRunner = (s) =>
    s === 'wikipedia' || s === 'web' ? Effect.succeed([]) : Effect.fail(new Error('parse'))
  const empty = yield* search('bun runtime', failing)
  expect(empty.meta.sources['wikipedia']?.status).toBe('no-results')
  expect(empty.meta.sources['hackernews']?.status).toBe('error')
}

function* degradedAndWeak() {
  const lone = yield* search('bun runtime', bySource(onlyWiki([hit('https://x.dev/a')])))
  expect(lone.meta.degraded).toBe(true)
  expect(lone.meta.weak).toBe(true)
  const agreed = yield* search('bun runtime', bySource({}))
  expect(agreed.meta.degraded).toBe(false)
  expect(agreed.meta.weak).toBe(false)
}

function* variantsMerge() {
  const runner: SourceRunner = (source, query) =>
    Effect.succeed(
      source !== 'wikipedia'
        ? []
        : query === 'bun runtime'
          ? [hit('https://a.dev/1'), hit('https://both.dev/x')]
          : [hit('https://both.dev/x'), hit('https://variant.dev/only')],
    )
  const { results } = yield* search('bun runtime', runner, { variants: ['bun javascript runtime'] })
  const urls = results.map((h) => h.url)
  expect(urls[0]).toBe('https://both.dev/x')
  expect(urls).toContain('https://variant.dev/only')
}

function* officialSiteBoost() {
  const list = [
    hit('https://en.wikipedia.org/wiki/Bun_(software)'),
    hit('https://www.reddit.com/r/bun'),
    hit('https://bun.sh/docs'),
  ]
  const { results } = yield* search('bun runtime', bySource(onlyWiki(list)))
  expect(results[0]?.url).toBe('https://bun.sh/docs')
}

function* duckDuckGoLast() {
  const answered: string[] = []
  yield* search('bun runtime', bySource({ hackernews: [], openalex: [] }, answered))
  const silent: string[] = []
  const none = yield* search('bun runtime', bySource(onlyWiki([]), silent))
  expect(answered.some((c) => c.startsWith('web:'))).toBe(false)
  expect(silent.filter((c) => c.startsWith('web:'))).toEqual(['web:bun runtime'])
  expect(none.meta.sources['web']?.status).toBe('ok')
}

describe('searchEffect — free sources at once', () => {
  test('total time stays near the slowest source, not the sum', effectTest(concurrentNotSummed))
  test('each status lands in the meta', effectTest(everyStatus), 10_000)
  test('degraded when under half answer; weak on one lone hit', effectTest(degradedAndWeak))
  test('variants merge and a URL both find ranks first', effectTest(variantsMerge))
  test('the official site outranks Wikipedia and aggregators', effectTest(officialSiteBoost))
  test('DuckDuckGo runs only when no free source has hits', effectTest(duckDuckGoLast))
})

const q = 'Where was Heisenberg born?'
const person = hit('https://en.wikipedia.org/wiki/Werner_Heisenberg', 'Werner Heisenberg')
const town = hit('https://www.wuerzburg.de/', 'Würzburg')
const offTopic = [hit('https://x.dev/born', 'Born (surname)'), hit('https://y.dev/b', 'Birthplace')]

function entityRule() {
  expect(mainEntity(q)).toBe('Heisenberg')
  expect(mainEntity('In what year was Ada Lovelace born?')).toBe('Ada Lovelace')
  expect(mainEntity('element with atomic number 79')).toBeUndefined()
}

function* entityThenFact() {
  const calls: string[] = []
  const runner: SourceRunner = (source, query) => {
    calls.push(`${source}:${query}`)
    if (source !== 'wikipedia') return Effect.succeed([])
    if (query === 'Heisenberg') return Effect.succeed([person])
    if (query === 'Where was Werner Heisenberg born?') return Effect.succeed([town, person])
    return Effect.succeed(offTopic)
  }
  const urls = (yield* search(q, runner, { hop: true }, 3)).results.map((h) => h.url)
  expect(urls[0]).toBe(person.url)
  expect(urls).toContain(town.url)
  expect(calls).toContain('wikipedia:Heisenberg')
  expect(calls).toContain('wikipedia:Where was Werner Heisenberg born?')
}

function* noHopNeeded() {
  const calls: string[] = []
  yield* search(q, bySource(onlyWiki([person]), calls), { hop: true })
  yield* search(q, bySource(onlyWiki(offTopic), calls))
  expect(calls.some((c) => c.endsWith(':Heisenberg'))).toBe(false)
}

// First round answers at once; every hop query hangs, so the deadline cuts in.
function* hopInsideDeadline() {
  const runner: SourceRunner = (source, query) =>
    query !== q ? Effect.never : Effect.succeed(source === 'wikipedia' ? offTopic : [])
  const t0 = yield* Clock.currentTimeMillis
  const { results } = yield* search(q, runner, { hop: true })
  expect(yield* elapsedSince(t0)).toBeLessThan(8_000)
  expect(results.map((h) => h.url)).toEqual(offTopic.map((h) => h.url))
}

// "the physicist who formulated the uncertainty principle": no name in the
// question, so the owner named in the top snippets becomes the entity.
function* bridgeHop() {
  const riddle = 'In which city was the physicist who formulated the uncertainty principle born?'
  const snippet = (url: string, description: string) => ({ title: url, url, description })
  const first = [
    snippet('https://x.dev/debates', "Bohr opposed Heisenberg's uncertainty principle."),
    snippet('https://y.dev/history', "Heisenberg's 1927 uncertainty principle."),
  ]
  const runner: SourceRunner = (source, query) =>
    Effect.succeed(source !== 'wikipedia' ? [] : query === 'Heisenberg' ? [person] : first)
  const urls = (yield* search(riddle, runner, { hop: true }, 3)).results.map((h) => h.url)
  expect(urls[0]).toBe(person.url)
}

describe('searchEffect — answer-mode second hop', () => {
  test('a question with no name hops through the owner in the snippets', effectTest(bridgeHop))
  test('mainEntity takes the longest capitalized run minus question words', entityRule)
  test('a missing entity page runs entity then fact', effectTest(entityThenFact))
  test('no hop when a top hit names the entity, or outside hop mode', effectTest(noHopNeeded))
  test('a hop past the deadline keeps the first round', effectTest(hopInsideDeadline), 12_000)
})

describe('pickSources — navigational software queries ask npm', () => {
  test('npm joins only software-navigational queries', () => {
    expect(pickSources('Bun JavaScript runtime official site')).toContain('npm')
    expect(pickSources('Effect TypeScript library documentation')).toContain('npm')
    expect(pickSources('What is the capital city of Australia?')).not.toContain('npm')
    expect(pickSources('bun runtime')).not.toContain('npm')
  })
})
