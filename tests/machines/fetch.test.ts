// Model-based test: the shortest path to every final state and context of
// the fetch machine, replayed against the real fetchTextWithinHost over real sockets.
// The run's timeout is the server's signal, fired when the hung request
// arrives (tests/_support/scripted-server.ts), so no path races wall time.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { getShortestPaths } from 'xstate/graph'
import { fetchTextWithinHost } from '../../src/core/http.ts'
import { fetchMachine } from '../../src/machines/fetch.ts'
import { finalPaths } from '../_support/paths.ts'
import { eff } from '../_support/run.ts'
import { type Reply, startScriptedServer } from '../_support/scripted-server.ts'

const REPLY_FOR_EVENT: Record<string, Reply> = {
  OK: { status: 200 },
  HTTP_ERROR: { status: 404 },
  RETRYABLE_STATUS: { status: 503 },
  NETWORK_ERROR: 'drop',
  TIMEOUT: 'hang',
  REDIRECT_SAME_HOST: { status: 302, location: '/next' },
  REDIRECT_OFF_HOST: { status: 302, location: 'http://off-host.invalid/' },
}

const OUTCOME_FOR_FINAL: Record<string, RegExp> = {
  succeeded: /^ok$/,
  httpFailed: /failed: (404|503)/,
  networkFailed: /closed|reset|ECONN|socket/i,
  timedOut: /timed? ?out/i,
  offHostBlocked: /off-site blocked/,
  tooManyRedirects: /too many redirects/,
}

const paths = finalPaths(fetchMachine, Object.keys(REPLY_FOR_EVENT), getShortestPaths)

const outcome = (origin: string, signal: AbortSignal) =>
  fetchTextWithinHost(`${origin}/start`, '127.0.0.1', { signal }).pipe(
    Effect.catch((e) => Effect.succeed(e.message)),
  )

describe('fetch machine matches fetchTextWithinHost', () => {
  test('the model reaches every final state', () => {
    expect(new Set(paths.map((p) => p.final))).toEqual(new Set(Object.keys(OUTCOME_FOR_FINAL)))
  })

  test.each(paths.map((p) => [`${p.final}: ${p.events.join(' ')}`, p] as const))(
    '%s',
    (_name, path) =>
      eff(
        Effect.gen(function* () {
          const server = yield* startScriptedServer()
          const signal = server.play(path.events.map((e) => REPLY_FOR_EVENT[e] ?? 'drop'))
          expect(yield* outcome(server.origin, signal)).toMatch(
            OUTCOME_FOR_FINAL[path.final] ?? /never/,
          )
          expect(server.served()).toBe(path.events.length)
        }),
      )(),
    10_000,
  )
})
