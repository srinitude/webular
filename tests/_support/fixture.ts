// Deterministic local HTTP fixture (Bun.serve, port 0) — a real server, not a
// mock. Tests assert against its stable content instead of the live internet.

import { afterAll, beforeAll } from 'bun:test'
import { Effect, Exit, Scope } from 'effect'

export type RouteFn = (req: Request, url: URL) => Response | Effect.Effect<Response>
export type Routes = Record<string, RouteFn>

export interface Fixture {
  origin: string
  hits(path: string): number
  stop(): void
}

const serve = (make: (origin: string) => Routes): Fixture => {
  const counts = new Map<string, number>()
  const routes: { current: Routes } = { current: {} }
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: (req) => {
      const url = new URL(req.url)
      counts.set(url.pathname, (counts.get(url.pathname) ?? 0) + 1)
      const handler = routes.current[url.pathname]
      const res = handler ? handler(req, url) : new Response('not found', { status: 404 })
      return Effect.isEffect(res) ? Effect.runPromise(res) : res
    },
  })
  const origin = `http://127.0.0.1:${server.port}`
  routes.current = make(origin)
  return { origin, hits: (path) => counts.get(path) ?? 0, stop: () => server.stop(true) }
}

// Owned by the enclosing Scope: the server stops when the scope closes.
export const startFixture = (
  make: (origin: string) => Routes,
): Effect.Effect<Fixture, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => serve(make)),
    (fx) => Effect.sync(() => fx.stop()),
  )

// Suite-wide fixture: opened in beforeAll, closed in afterAll. The returned
// handle reads through to the live fixture, so tests use fx.origin as before.
export function useFixture(make: (origin: string) => Routes): Fixture {
  const scope = Effect.runSync(Scope.make())
  const live: { fx?: Fixture } = {}
  beforeAll(() =>
    Effect.runPromise(
      startFixture(make).pipe(
        Effect.tap((fx) =>
          Effect.sync(() => {
            live.fx = fx
          }),
        ),
        Scope.provide(scope),
      ),
    ),
  )
  afterAll(() => Effect.runPromise(Scope.close(scope, Exit.void)))
  return {
    get origin() {
      return live.fx?.origin ?? ''
    },
    hits: (path) => live.fx?.hits(path) ?? 0,
    stop: () => live.fx?.stop(),
  }
}
