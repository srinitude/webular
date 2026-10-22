// A /sitemap.xml failure other than 404 is reported in `errors`; a 404 stays silent.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { mapWorkflow } from '../../src/workflows/map.ts'
import { type Routes, startFixture } from '../_support/fixture.ts'
import { eff, io } from '../_support/run.ts'

const html = () =>
  new Response('<!doctype html><html><body>hi</body></html>', {
    headers: { 'content-type': 'text/html' },
  })

const runMap = (url: string) =>
  Effect.gen(function* () {
    const run = yield* io(() => mapWorkflow.createRun({ runId: 'map-sitemap-error' }))
    const outcome = yield* io(() => run.start({ inputData: { url } }))
    if (outcome.status !== 'success')
      return yield* Effect.fail(new Error(`map failed: ${outcome.status}`))
    return outcome.result as { errors: { url: string; reason: string }[] }
  })

const mapWithSitemap = (status: number) =>
  Effect.gen(function* () {
    const fx = yield* startFixture(
      (): Routes => ({
        '/': html,
        '/sitemap.xml': () => new Response('nope', { status }),
      }),
    )
    return { origin: fx.origin, ...(yield* runMap(`${fx.origin}/`)) }
  })

describe('map: sitemap.xml failures', () => {
  test(
    'reports a 500 from /sitemap.xml in errors',
    eff(
      Effect.gen(function* () {
        const { origin, errors } = yield* mapWithSitemap(500)
        expect(errors.map((e) => e.url)).toContain(`${origin}/sitemap.xml`)
      }),
    ),
    30_000,
  )

  test(
    'keeps a 404 from /sitemap.xml silent',
    eff(
      Effect.gen(function* () {
        const { errors } = yield* mapWithSitemap(404)
        expect(errors).toEqual([])
      }),
    ),
    15_000,
  )
})
