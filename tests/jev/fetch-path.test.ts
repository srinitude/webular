// The fetch path asks fetch.error, fetch.block, and fetch.browser. Each test runs
// the real fetch against a local server: with Jev off the code rule answers, and a
// recorded sure Jev pick changes the outcome.
import { expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { fetchTextOrArchive } from '../../src/core/archive.ts'
import { fetchText } from '../../src/core/http.ts'
import { Jev, type JevResult } from '../../src/lib/jev/client.ts'
import { needsJs, wantsRender } from '../../src/workflows/scrape-fallback.ts'

const off = Layer.succeed(Jev)(Jev.of({ available: false, ask: () => Effect.die('unused') }))
// A recorded answer: both option orders agree on `choice` at 0.99, but only for
// the named decision; any other decision gets none_of_the_above.
const recorded = (decision: string, choice: string) =>
  Layer.succeed(Jev)(
    Jev.of({
      available: true,
      ask: (d) => {
        const c = d === decision ? choice : 'none_of_the_above'
        return Effect.succeed({
          answers: {
            pick: { choice: c, confidence: 0.99 },
            pick_reversed: { choice: c, confidence: 0.99 },
          },
        } as unknown as JevResult)
      },
    }),
  )

const TS = '20240101000000'
// A plain article with one script: needsJs passes it as static.
const PAGE = `<html><body><article><h1>Tide tables</h1>${[1, 2, 3, 4]
  .map(
    (n) =>
      `<p>Paragraph ${n}: the harbor tide rises twice a day, and the boats wait at the pier, since the channel is shallow, narrow, and full of sand.</p>`,
  )
  .join('')}</article><script>boot()</script></body></html>`

const server = Effect.acquireRelease(
  Effect.sync(() =>
    Bun.serve({
      port: 0,
      maxRequestBodySize: 1024,
      fetch: (req) => {
        const { pathname, origin } = new URL(req.url)
        if (pathname === '/wayback/available')
          return Response.json({
            archived_snapshots: {
              closest: {
                available: true,
                status: '200',
                url: `${origin}/web/${TS}/${origin}/walled`,
                timestamp: TS,
              },
            },
          })
        if (pathname.startsWith('/web/')) return new Response('<p>archived copy</p>')
        if (pathname === '/walled') return new Response('denied', { status: 403 })
        return new Response(PAGE, { headers: { 'content-type': 'text/html' } })
      },
    }),
  ),
  (s) => Effect.promise(() => s.stop(true)),
)

const run = <A, E>(layer: Layer.Layer<Jev>, body: (origin: string) => Effect.Effect<A, E, Jev>) =>
  Effect.scoped(Effect.flatMap(server, (s) => body(`http://localhost:${s.port}`))).pipe(
    Effect.provide(layer),
  )

const archive = (origin: string) =>
  fetchTextOrArchive(`${origin}/walled`, { archiveOrigin: origin }).pipe(
    Effect.map((r) => r.html),
    Effect.catchTag('HttpStatusError', (e) => Effect.succeed(`failed ${e.status}`)),
  )

// needsJs is false for the page, so only a Jev pick can ask for a render.
const render = (origin: string) =>
  Effect.gen(function* () {
    const html = yield* fetchText(`${origin}/page`)
    expect(needsJs(html)).toBe(false)
    return yield* wantsRender(`${origin}/page`, html, 2_000)
  })

test('fetch.error: Jev off keeps the 403; a try_archive pick reads the archive', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      expect(yield* run(off, archive)).toBe('failed 403')
      expect(yield* run(recorded('fetch.error', 'try_archive'), archive)).toContain('archived copy')
    }),
  ))

test('fetch.block: Jev off keeps the static page; a captcha pick asks for a render', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      expect(yield* run(off, render)).toBe(false)
      expect(yield* run(recorded('fetch.block', 'captcha'), render)).toBe(true)
    }),
  ))

test('fetch.browser: Jev off keeps the static page; a js_shell pick asks for a render', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      expect(yield* run(off, render)).toBe(false)
      expect(yield* run(recorded('fetch.browser', 'js_shell'), render)).toBe(true)
    }),
  ))
