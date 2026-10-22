// `scrape` on a host that refuses connections fails with the real network error,
// It never reports `blocked`/`robots`: RFC 9309 disallows on a 5xx robots.txt,
// not on a host it cannot reach. Run by `mise run bugs:mcp-cli`.
import { expect, test } from 'bun:test'
import { Duration, Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { eff } from '../_support/run.ts'

// A refused connection fails in about 2 s (robots read plus page GET). 10 s
// leaves room for a loaded machine and fails if a retry or fallback returns.
const MAX_FAIL_MS = 10_000

// A port that was just bound and released: connecting to it is refused.
const closedPort = Effect.sync(() => {
  const server = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } })
  const { port } = server
  server.stop(true)
  return port
})

test(
  'scrape on an unreachable host fails with the network error, not robots',
  eff(
    Effect.gen(function* () {
      const port = yield* closedPort
      const [took, { code, out, err }] = yield* Effect.timed(
        runCli('src/commands/scrape.ts', [
          '--url',
          `http://127.0.0.1:${port}/page`,
          '--render',
          'off',
          '--json',
        ]),
      )
      expect(Duration.toMillis(took)).toBeLessThan(MAX_FAIL_MS)
      expect(out + err).not.toContain('robots')
      expect(out + err).not.toContain('"blocked"')
      expect(code).not.toBe(0)
    }),
  ),
  45_000,
)
