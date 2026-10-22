// MONITOR on a page that is down: the archived copy it reads instead must be
// reported as the archive, with its capture date, plus a warning, so it is
// never mistaken for a fresh check of the live page. Real local Bun.serve
// fixture (WEBULAR_SOURCE_ORIGIN swaps every free-source origin). No mocks.
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Config, Effect, Schema } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff, tmpDir } from '../_support/run.ts'

const TS = '20260102030405'
const snapshot =
  '<html><body><article><h1>Snapshot</h1><p>Kept by the archive.</p></article></body></html>'
const html = () => new Response(snapshot, { headers: { 'content-type': 'text/html' } })

const fx = useFixture((origin) => ({
  '/wayback/available': (_req, url) => {
    const closest = {
      status: '200',
      available: true,
      url: `${origin}/web/${TS}/snap`,
      timestamp: TS,
    }
    return Response.json({ url: url.searchParams.get('url'), archived_snapshots: { closest } })
  },
  [`/web/${TS}/snap`]: html,
  [`/web/${TS}id_/snap`]: html,
}))

const MonitorJson = Schema.fromJsonString(
  Schema.Struct({ archivedFrom: Schema.optional(Schema.String) }),
)

const monitor = (path: string, dbPath: string) =>
  Effect.gen(function* () {
    const PATH = yield* Config.String('PATH')
    const HOME = yield* Config.String('HOME').pipe(Config.withDefault('/tmp'))
    const env = { PATH, HOME, WEBULAR_SOURCE_ORIGIN: fx.origin, WEBULAR_SOURCE_GAP_MS: '0' }
    const args = ['--url', `${fx.origin}${path}`, '--db', dbPath, '--json']
    return yield* runCli('src/commands/monitor.ts', args, { env })
  })

describe('webular monitor: a down page read from its archive copy', () => {
  test(
    'reports archivedFrom with the capture date and a warning, never a fresh check',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-monitor-archive-')
        const { code, out, err } = yield* monitor('/dead', join(dir, 'snap.db'))
        expect(code).toBe(0)
        const result = yield* Schema.decodeUnknownEffect(MonitorJson)(out)
        expect(result.archivedFrom).toContain(`/web/${TS}`)
        expect(err).toMatch(/archive/i)
      }),
    ),
    60_000,
  )
})
