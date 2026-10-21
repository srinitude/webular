// batch and scrape --archive: a dead page (410) reads from the Internet
// Archive's closest capture. WEBULAR_SOURCE_ORIGIN points the availability
// lookup at a real local Bun.serve fixture whose body is the recorded
// wayback-available.json with its web.archive.org host swapped for the fixture.
// Without --archive the dead page stays an error. No mocks, no live network.
import { describe, expect, test } from 'bun:test'
import { Config, Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'
import { body, json } from '../lib/sources/support.ts'

const CAPTURE = '/web/20261021030512id_/https://example.com/'

const withArchive = <A, E, R>(
  use: (origin: string, env: Record<string, string>) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const available = yield* body('wayback-available.json')
    const page = yield* body('archive-copy-page.html')
    const fx = yield* startFixture((origin) => ({
      '/dead': () => new Response('gone', { status: 410 }),
      '/wayback/available': () => json(available.replace('http://web.archive.org', origin)),
      [CAPTURE]: () => new Response(page, { headers: { 'content-type': 'text/html' } }),
    }))
    const PATH = yield* Config.String('PATH').pipe(Config.orElse(() => Config.String('Path')))
    const HOME = yield* Config.String('HOME').pipe(Config.withDefault('/tmp'))
    return yield* use(fx.origin, {
      PATH,
      HOME,
      WEBULAR_SOURCE_ORIGIN: fx.origin,
      WEBULAR_SOURCE_GAP_MS: '0',
    })
  })

describe('archive fallback behind scrape and batch', () => {
  test(
    'batch --archive reads a dead page from the archive copy',
    eff(
      withArchive((origin, env) =>
        Effect.gen(function* () {
          const run = yield* runCli(
            'src/commands/batch.ts',
            ['--urls', `${origin}/dead`, '--archive', '--json'],
            { env },
          )
          expect(run.code).toBe(0)
          const [first] = JSON.parse(run.out).results
          expect(first.ok).toBe(true)
          expect(first.title).toBe('Archived example')
        }),
      ),
    ),
    45_000,
  )

  test(
    'batch without --archive keeps the dead page an error',
    eff(
      withArchive((origin, env) =>
        Effect.gen(function* () {
          const run = yield* runCli(
            'src/commands/batch.ts',
            ['--urls', `${origin}/dead`, '--json'],
            {
              env,
            },
          )
          expect(run.code).toBe(1)
          expect(JSON.parse(run.out).results[0].ok).toBe(false)
        }),
      ),
    ),
    45_000,
  )

  test(
    'scrape --archive reports the capture it read as archivedFrom',
    eff(
      withArchive((origin, env) =>
        Effect.gen(function* () {
          const run = yield* runCli(
            'src/commands/scrape.ts',
            ['--url', `${origin}/dead`, '--archive', '--json'],
            { env },
          )
          expect(run.code).toBe(0)
          expect(JSON.parse(run.out).archivedFrom).toBe(`${origin}${CAPTURE}`)
        }),
      ),
    ),
    45_000,
  )
})
