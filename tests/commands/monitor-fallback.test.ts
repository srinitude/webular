// MONITOR free-source fallback, against a real local Bun.serve fixture
// (WEBULAR_SOURCE_ORIGIN swaps every free-source endpoint origin). The watched
// page answers 404, so monitor asks the free sources: only Wayback's
// availability answers, with a snapshot that lives on the fixture. The result
// names that copy in `archivedFrom` and stderr warns that it is archived; the
// exit stays 0. Only PATH and HOME reach the child, so no key in the caller's
// environment sends it to a live service. No mocks.
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Config, Effect, Schema } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff, tmpDir } from '../_support/run.ts'

const snapshot =
  '<html><body><article><h1>Snapshot</h1><p>Kept by the archive.</p></article></body></html>'

const fx = useFixture((origin) => ({
  '/wayback/available': (_req, url) => {
    const closest = { status: '200', available: true, url: `${origin}/snap`, timestamp: '20260102' }
    return Response.json({ url: url.searchParams.get('url'), archived_snapshots: { closest } })
  },
  '/snap': () => new Response(snapshot, { headers: { 'content-type': 'text/html' } }),
}))

const Result = Schema.fromJsonString(
  Schema.Struct({
    url: Schema.String,
    changeStatus: Schema.String,
    archivedFrom: Schema.optional(Schema.String),
  }),
)

const monitor = (path: string, dbPath: string) =>
  Effect.gen(function* () {
    const PATH = yield* Config.String('PATH').pipe(Config.orElse(() => Config.String('Path')))
    const HOME = yield* Config.String('HOME').pipe(Config.withDefault('/tmp'))
    const env = { PATH, HOME, WEBULAR_SOURCE_ORIGIN: fx.origin, WEBULAR_SOURCE_GAP_MS: '0' }
    const args = ['--url', `${fx.origin}${path}`, '--db', dbPath, '--json']
    return yield* runCli('src/commands/monitor.ts', args, { env })
  })

describe('webular monitor — free-source fallback', () => {
  test(
    'a page that fails to load is watched through its Wayback snapshot',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-monitor-fallback-')
        const { code, out, err } = yield* monitor('/dead', join(dir, 'snap.db'))
        expect(code).toBe(0)
        expect(err).toMatch(/warning: .*archived copy/)
        expect(yield* Schema.decodeUnknownEffect(Result)(out)).toEqual({
          url: `${fx.origin}/dead`,
          changeStatus: 'new',
          archivedFrom: `${fx.origin}/snap`,
        })
      }),
    ),
    60_000,
  )
})
