// MONITOR free-source fallback, against a real local Bun.serve fixture
// (WEBULAR_SOURCE_ORIGIN swaps every free-source endpoint origin). The watched
// page answers 404, so monitor asks the free sources: only Wayback's
// availability answers, with a snapshot that lives on the fixture. No mocks.
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect } from 'effect'
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

const monitor = (path: string, dbPath: string) =>
  runCli('src/commands/monitor.ts', ['--url', `${fx.origin}${path}`, '--db', dbPath, '--json'], {
    env: { ...process.env, WEBULAR_SOURCE_ORIGIN: fx.origin, WEBULAR_SOURCE_GAP_MS: '0' },
  })

describe('webular monitor — free-source fallback', () => {
  test(
    'a page that fails to load is watched through its Wayback snapshot',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-monitor-fallback-')
        const { code, out, err } = yield* monitor('/dead', join(dir, 'snap.db'))
        expect(err).toBe('')
        expect(code).toBe(0)
        expect(JSON.parse(out)).toMatchObject({ url: `${fx.origin}/dead`, changeStatus: 'new' })
      }),
    ),
    20_000,
  )
})
