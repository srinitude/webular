// Outcome eval: an agent that reads a crawl result can tell when the page limit
// cut the crawl short, so it knows to raise --limit instead of reporting a
// partial site as the whole site.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { crawlWorkflow } from '../../src/workflows/crawl.ts'
import { type Routes, useFixture } from '../_support/fixture.ts'
import { eff, io } from '../_support/run.ts'

const page = (title: string, links: string[]) => () =>
  new Response(
    `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><p>Body of ${title}.</p>${links.map((h) => `<a href="${h}">${h}</a>`).join('')}</body></html>`,
    { headers: { 'content-type': 'text/html' } },
  )

const site = (_origin: string): Routes => ({
  '/': page('Home', ['/a', '/b', '/c']),
  '/a': page('Alpha', []),
  '/b': page('Beta', []),
  '/c': page('Gamma', []),
})

const fx = useFixture(site)

const crawl = (limit: number) =>
  io(async () => {
    const run = await crawlWorkflow.createRun({ runId: `limit-${limit}` })
    return run.start({ inputData: { url: `${fx.origin}/`, limit, depth: 2 } })
  })

const output = (r: { status: string; result?: unknown }) =>
  (r.status === 'success' ? r.result : {}) as { count?: number; limitReached?: boolean }

test(
  'a crawl cut by the page limit says so',
  eff(
    Effect.gen(function* () {
      const out = output(yield* crawl(2))
      expect(out.count).toBe(2)
      expect(out.limitReached).toBe(true)
    }),
  ),
)

test(
  'a crawl that read the whole site does not claim a cut',
  eff(
    Effect.gen(function* () {
      const out = output(yield* crawl(10))
      expect(out.count).toBe(4)
      expect(out.limitReached).toBe(false)
    }),
  ),
)
