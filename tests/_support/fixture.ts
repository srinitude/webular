// Deterministic local HTTP fixture (Bun.serve, port 0) — a real server, not a
// mock. Tests assert against its stable content instead of the live internet.
export type RouteFn = (req: Request, url: URL) => Response | Promise<Response>
export type Routes = Record<string, RouteFn>

export interface Fixture {
  origin: string
  hits(path: string): number
  stop(): void
}

export function startFixture(make: (origin: string) => Routes): Fixture {
  const counts = new Map<string, number>()
  let routes: Routes = {}
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)
      counts.set(url.pathname, (counts.get(url.pathname) ?? 0) + 1)
      const handler = routes[url.pathname]
      return handler ? handler(req, url) : new Response('not found', { status: 404 })
    },
  })
  const origin = `http://127.0.0.1:${server.port}`
  routes = make(origin)
  return {
    origin,
    hits: (path) => counts.get(path) ?? 0,
    stop: () => server.stop(true),
  }
}
