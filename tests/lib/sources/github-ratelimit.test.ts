// GitHub search rate limits against a real local Bun.serve fixture: once the
// headers say the pool is empty (x-ratelimit-remaining 0, or a 403/429 with
// retry-after), later searches skip GitHub until the reset with a 429 reason,
// and GITHUB_TOKEN / GH_TOKEN go out as an Authorization header. No mocks.
import { describe, expect, test } from 'bun:test'
import { Clock, Effect } from 'effect'
import { freeSourceFallback } from '../../../src/lib/sources/registry.ts'
import { GitHubLimit, githubSearch } from '../../../src/lib/sources/web.ts'
import { against, body, json, run } from './support.ts'

const REPOS = JSON.stringify({
  items: [
    { full_name: 'a/b', html_url: 'https://github.com/a/b', description: 'x', stargazers_count: 3 },
  ],
})

// A route that answers with `status` and `headers`, counting requests and the auth header.
const counted = (status: number, headers: Record<string, string>) => {
  const seen = { calls: 0, auth: '' as string | null }
  const route = (req: Request) => {
    seen.calls++
    seen.auth = req.headers.get('authorization')
    return new Response(REPOS, {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    })
  }
  return { seen, routes: { '/search/repositories': route } }
}

const fresh = <A, E, R>(eff: Effect.Effect<A, E, R>) =>
  Effect.provideService(eff, GitHubLimit, { until: 0 })

const twice = (status: number, headers: Record<string, string>) =>
  fresh(
    Effect.gen(function* () {
      const { seen, routes } = counted(status, headers)
      const search = githubSearch('effect', 1).pipe(Effect.result)
      const first = yield* against(routes, search)
      const second = yield* against(routes, search)
      return { seen, first, second }
    }),
  )

const skippedWith429 = (r: { _tag: string; failure?: unknown }) => {
  expect(r._tag).toBe('Failure')
  const err = r.failure as { status: number; message: string }
  expect(err.status).toBe(429)
  expect(err.message).toContain('rate limited until')
}

const resetIn60 = Effect.map(Clock.currentTimeMillis, (now) => String(Math.ceil(now / 1000) + 60))

const remainingZero = Effect.gen(function* () {
  const reset = yield* resetIn60
  const out = yield* twice(200, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset })
  expect(out.first._tag).toBe('Success')
  skippedWith429(out.second)
  expect(out.seen.calls).toBe(1)
})

const retryAfter = Effect.gen(function* () {
  const out = yield* twice(403, { 'retry-after': '30' })
  expect(out.first._tag).toBe('Failure')
  skippedWith429(out.second)
  expect(out.seen.calls).toBe(1)
})

// Retry-After may be an HTTP-date instead of seconds (RFC 9110); a 403 only
// counts as spent through it.
const retryAfterDate = Effect.gen(function* () {
  const now = yield* Clock.currentTimeMillis
  const out = yield* twice(403, { 'retry-after': new Date(now + 90_000).toUTCString() })
  skippedWith429(out.second)
  expect(out.seen.calls).toBe(1)
})

const remainingLeft = Effect.gen(function* () {
  const reset = yield* resetIn60
  const out = yield* twice(200, { 'x-ratelimit-remaining': '9', 'x-ratelimit-reset': reset })
  expect(out.second._tag).toBe('Success')
  expect(out.seen.calls).toBe(2)
})

const tokens = Effect.gen(function* () {
  for (const key of ['GITHUB_TOKEN', 'GH_TOKEN']) {
    const { seen, routes } = counted(200, {})
    yield* against(routes, githubSearch('effect', 1), { [key]: 'fixture-token' })
    expect(seen.auth).toBe('Bearer fixture-token')
  }
  const { seen, routes } = counted(200, {})
  yield* against(routes, githubSearch('effect', 1))
  expect(seen.auth).toBeNull()
})

// The search fallback while GitHub is out of quota, in both of GitHub's forms
// (403 with remaining 0, 429 with retry-after): Wikidata still answers both
// searches, and the second search never asks GitHub.
const fallbackCase = (status: number, headers: Record<string, string>) =>
  fresh(
    Effect.gen(function* () {
      const wiki = yield* body('wikidata-search.json')
      const { seen, routes } = counted(status, headers)
      const all = { ...routes, '/w/api.php': () => json(wiki) }
      const ask = freeSourceFallback('search', 'effect', 2)
      for (const out of [yield* against(all, ask), yield* against(all, ask)]) {
        expect(out.source).toBe('wikidata')
        expect(out.results.length).toBeGreaterThan(0)
        expect(out.failures.map((f) => f.source)).toContain('github-search')
      }
      expect(seen.calls).toBe(1)
    }),
  )

const fallbackSpent = Effect.gen(function* () {
  const reset = yield* resetIn60
  yield* fallbackCase(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset })
  yield* fallbackCase(429, { 'retry-after': '60' })
})

describe('github search rate limit', () => {
  test('remaining 0 skips GitHub until x-ratelimit-reset', () => run(remainingZero))
  test('403 with retry-after skips GitHub for that long', () => run(retryAfter))
  test('403 with an HTTP-date retry-after skips GitHub until then', () => run(retryAfterDate))
  test('remaining above 0 keeps asking GitHub', () => run(remainingLeft))
  test('GITHUB_TOKEN or GH_TOKEN goes out as a bearer token', () => run(fresh(tokens)))
  test('search fallback answers from other sources while GitHub is spent', () => run(fallbackSpent))
})
