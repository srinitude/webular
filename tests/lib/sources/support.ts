// Shared plumbing for the source adapter tests: recorded bodies, a real local
// Bun.serve fixture whose origin reaches the adapters through the
// ConfigProvider (WEBULAR_SOURCE_ORIGIN), and a fresh per-host slot table.
import { ConfigProvider, Effect, type Scope } from 'effect'
import { SparqlCache } from '../../../src/lib/sources/creator-products.ts'
import { HostSlots } from '../../../src/lib/sources/polite.ts'
import { type Routes, startFixture } from '../../_support/fixture.ts'

export const body = (name: string) =>
  Effect.promise(() => Bun.file(`${import.meta.dir}/../../fixtures/sources/${name}`).text())

export const json = (text: string, status = 200) =>
  new Response(text, { status, headers: { 'content-type': 'application/json' } })

export const against = <A, E>(
  routes: Routes,
  eff: Effect.Effect<A, E>,
  extra: Record<string, string> = {},
) =>
  startFixture(() => routes).pipe(
    Effect.flatMap((fx) =>
      Effect.provideService(
        eff,
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({
          WEBULAR_MAILTO: 'me@example.com',
          WEBULAR_NO_CACHE: '1',
          WEBULAR_SOURCE_ORIGIN: fx.origin,
          ...extra,
        }),
      ),
    ),
  )

// Serve `text` at `path`, run `eff` against it, and return what the server saw.
export const serving = <A, E>(
  path: string,
  text: string,
  eff: Effect.Effect<A, E>,
  status = 200,
) => {
  const seen = { query: new URLSearchParams(), agent: '' }
  const route = (req: Request, url: URL) => {
    seen.query = url.searchParams
    seen.agent = req.headers.get('user-agent') ?? ''
    return json(text, status)
  }
  return against({ [path]: route }, eff).pipe(Effect.map((out) => ({ out, seen })))
}

export const run = <A, E>(eff: Effect.Effect<A, E, Scope.Scope>) =>
  eff.pipe(
    Effect.scoped,
    Effect.provideService(HostSlots, new Map()),
    Effect.provideService(SparqlCache, new Map()),
    Effect.runPromise,
  )
