// Outcome eval: a batch where one URL fails still hands the agent every
// result, with the failed URL named, instead of one error that hides the rest.
// The model-matrix smoke saw the batch tool fail whole on a partial run (the
// command exits 3 for partial and prints the full result on stdout).
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { Effect, Schema } from 'effect'
import { runCommand } from '../src/commands.ts'

const commands = fileURLToPath(new URL('../../../src/commands', import.meta.url))
const page =
  '<html><head><title>Good page</title></head><body><article><h1>Good page</h1><p>Webular reads this page.</p></article></body></html>'

const Batch = Schema.Struct({
  results: Schema.Array(Schema.Struct({ url: Schema.String, ok: Schema.Boolean })),
})

// / is a page, /gone is a 404: one good URL and one bad one, both local.
const site = Effect.acquireRelease(
  Effect.sync(() =>
    Bun.serve({
      port: 0,
      maxRequestBodySize: 1024,
      fetch: (req) =>
        new URL(req.url).pathname === '/gone'
          ? new Response('gone', { status: 404 })
          : new Response(page, { headers: { 'content-type': 'text/html' } }),
    }),
  ),
  (server) => Effect.promise(() => server.stop(true)),
)

const batchOf = (good: string, bad: string) =>
  runCommand('batch', { urls: [good, bad] }, 0, (c) => `${commands}/${c}.ts`).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Batch)),
    Effect.map((batch) => batch.results.map((r) => [r.url, r.ok])),
  )

test(
  'batch with one missing page returns the good page and names the bad one',
  () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const server = yield* site
          const good = server.url.href
          const bad = new URL('/gone', server.url).href
          expect(yield* batchOf(good, bad)).toEqual([
            [good, true],
            [bad, false],
          ])
        }),
      ).pipe(Effect.provide(BunServices.layer)),
    ),
  30_000,
)
