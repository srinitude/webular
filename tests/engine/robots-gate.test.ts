// robots.txt gate: a one-off scrape, batch, and map never GET a disallowed
// path; only `ignoreRobots` on a named URL fetches it anyway. RFC 9309 status
// rules: a 4xx robots.txt allows all, a 5xx one disallows all.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { isAllowed, robotsFromResponse } from '../../src/lib/robots-txt.ts'
import { batchWorkflow } from '../../src/workflows/batch.ts'
import { mapWorkflow } from '../../src/workflows/map.ts'
import { scrapeWorkflow } from '../../src/workflows/scrape.ts'
import { type Routes, startFixture } from '../_support/fixture.ts'
import { eff, io } from '../_support/run.ts'

const PROSE =
  '<p>Deterministic fixture body for the robots gate. It has enough prose to satisfy readability extraction.</p>'
const page = (title: string) =>
  new Response(
    `<!doctype html><html><head><title>${title}</title></head><body>${PROSE}</body></html>`,
    { headers: { 'content-type': 'text/html' } },
  )

const site = (robots: () => Response) => (): Routes => ({
  '/robots.txt': robots,
  '/private/page': () => page('Private'),
  '/open': () => page('Open'),
})
const disallowPrivate = site(() => new Response('User-agent: *\nDisallow: /private/\n'))

interface Startable {
  start(o: { inputData: never }): Promise<{ status: string; result?: unknown }>
}
const runFlow = (create: () => Promise<Startable>, inputData: Record<string, unknown>) =>
  Effect.gen(function* () {
    const run = yield* io(create)
    const outcome = yield* io(() => run.start({ inputData: inputData as never }))
    if (outcome.status !== 'success') return yield* Effect.fail(new Error(outcome.status))
    return outcome.result as Record<string, unknown>
  })
const scrape = (input: Record<string, unknown>) =>
  runFlow(() => scrapeWorkflow.createRun({ runId: `robots:${input['url']}` }), {
    render: 'off',
    ...input,
  })

const blockedScrape = Effect.gen(function* () {
  const fx = yield* startFixture(disallowPrivate)
  const out = yield* scrape({ url: `${fx.origin}/private/page` })
  const want = { status: 'blocked', reason: 'robots', rule: '/private/', userAgent: 'webular' }
  expect(out).toMatchObject(want)
  expect(fx.hits('/private/page')).toBe(0)
})
test(
  'scrape: a disallowed page comes back blocked and is never fetched',
  eff(blockedScrape),
  15_000,
)

const noFallback = Effect.gen(function* () {
  const fx = yield* startFixture(disallowPrivate)
  const url = `${fx.origin}/private/page`
  const out = yield* scrape({ url, archive: true, render: 'agent-browser' })
  expect(out).toMatchObject({ status: 'blocked', reason: 'robots' })
  expect(out['archivedFrom']).toBeUndefined()
  expect(out['renderedBy']).toBeUndefined()
  expect(fx.hits('/private/page')).toBe(0)
})
test(
  'scrape: a robots block never falls back to the archive or the browser',
  eff(noFallback),
  15_000,
)

const override = Effect.gen(function* () {
  const fx = yield* startFixture(disallowPrivate)
  const out = yield* scrape({ url: `${fx.origin}/private/page`, ignoreRobots: true })
  expect(out).toMatchObject({ title: 'Private', robots: 'disallowed' })
  expect(fx.hits('/private/page')).toBe(1)
})
test('scrape: ignoreRobots fetches the named page and marks it disallowed', eff(override), 15_000)

const statusRules = Effect.gen(function* () {
  const gone = yield* startFixture(site(() => new Response('', { status: 404 })))
  expect(yield* scrape({ url: `${gone.origin}/open` })).toMatchObject({ title: 'Open' })
  const down = yield* startFixture(site(() => new Response('', { status: 503 })))
  const out = yield* scrape({ url: `${down.origin}/open` })
  expect(out).toMatchObject({ status: 'blocked', reason: 'robots', rule: '/' })
  expect(down.hits('/open')).toBe(0)
})
test('scrape: a 404 robots.txt allows the page; a 503 one blocks it', eff(statusRules), 30_000)

const batchBlocked = Effect.gen(function* () {
  const fx = yield* startFixture(disallowPrivate)
  const urls = [`${fx.origin}/private/page`, `${fx.origin}/open`]
  const out = yield* runFlow(() => batchWorkflow.createRun({ runId: 'robots-batch' }), { urls })
  const results = out['results'] as Record<string, unknown>[]
  expect(results[0]).toMatchObject({ ok: false, status: 'blocked', reason: 'robots' })
  expect(results[1]).toMatchObject({ ok: true })
  expect(fx.hits('/private/page')).toBe(0)
})
test('batch: a disallowed URL is blocked and never fetched', eff(batchBlocked), 30_000)

const mapBlocked = Effect.gen(function* () {
  const fx = yield* startFixture(disallowPrivate)
  const url = `${fx.origin}/private/page`
  yield* runFlow(() => mapWorkflow.createRun({ runId: 'robots-map' }), { url })
  expect(fx.hits('/private/page')).toBe(0)
})
test('map: a disallowed target is never fetched for its page links', eff(mapBlocked), 15_000)

test('robots.txt status rules: 4xx allows all; 5xx, status 0, and no reply disallow all', () => {
  const allowed = (r: { status: number; body: string } | null) =>
    isAllowed(robotsFromResponse(r, 'webular'), '/x')
  expect(allowed({ status: 404, body: '' })).toBe(true)
  expect(allowed({ status: 503, body: '' })).toBe(false)
  expect(allowed({ status: 0, body: '' })).toBe(false)
  expect(allowed(null)).toBe(false)
})
