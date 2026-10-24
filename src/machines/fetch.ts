// Fetch path (src/core/http.ts): each request gets a per-attempt timeout;
// retryable statuses and network errors retry on a fixed backoff; a timeout
// never retries. In host-scoped fetches (fetchTextWithinHost) a same-host
// redirect starts a fresh request with fresh retries, an off-host redirect is
// blocked, and the REDIRECT_LIMIT-th redirect fails. Every number comes from
// src/core/fetch-policy.ts; http.ts steps this machine to decide each move.
// Fallback chains from the reliable-sources work would extend `succeeded`'s
// siblings: each failed final state would gain a "try next source" transition
// back to `requesting` with the next source in context.
import { Effect } from 'effect'
import { type EventFromLogic, type SnapshotFrom, setup, types } from 'xstate'
import { MAX_RETRIES, REDIRECT_LIMIT, RETRY_ON_TIMEOUT } from '../core/fetch-policy.ts'
import { decideAt } from './agent.ts'

const canRetry = (attempt: number) => attempt < MAX_RETRIES

export const fetchMachine = setup({
  schemas: {
    context: types<{ attempt: number; hops: number }>(),
    events: {
      OK: types<void>(),
      HTTP_ERROR: types<void>(),
      RETRYABLE_STATUS: types<void>(),
      NETWORK_ERROR: types<void>(),
      TIMEOUT: types<void>(),
      REDIRECT_SAME_HOST: types<void>(),
      REDIRECT_OFF_HOST: types<void>(),
    },
  },
}).createMachine({
  id: 'fetch',
  context: { attempt: 0, hops: 0 },
  initial: 'requesting',
  states: {
    requesting: {
      on: {
        OK: { target: 'succeeded' },
        HTTP_ERROR: { target: 'httpFailed' },
        RETRYABLE_STATUS: ({ context }) =>
          canRetry(context.attempt)
            ? {
                target: 'requesting',
                reenter: true,
                context: { ...context, attempt: context.attempt + 1 },
              }
            : { target: 'httpFailed' },
        NETWORK_ERROR: ({ context }) =>
          canRetry(context.attempt)
            ? {
                target: 'requesting',
                reenter: true,
                context: { ...context, attempt: context.attempt + 1 },
              }
            : { target: 'networkFailed' },
        TIMEOUT: ({ context }) =>
          RETRY_ON_TIMEOUT && canRetry(context.attempt)
            ? {
                target: 'requesting',
                reenter: true,
                context: { ...context, attempt: context.attempt + 1 },
              }
            : { target: 'timedOut' },
        REDIRECT_SAME_HOST: ({ context }) =>
          context.hops < REDIRECT_LIMIT - 1
            ? {
                target: 'requesting',
                reenter: true,
                context: { hops: context.hops + 1, attempt: 0 },
              }
            : { target: 'tooManyRedirects' },
        REDIRECT_OFF_HOST: { target: 'offHostBlocked' },
      },
    },
    succeeded: { type: 'final' },
    httpFailed: { type: 'final' },
    networkFailed: { type: 'final' },
    timedOut: { type: 'final' },
    offHostBlocked: { type: 'final' },
    tooManyRedirects: { type: 'final' },
  },
})

type FetchEvent = EventFromLogic<typeof fetchMachine>

// After a failed attempt the Stately agent picks between retrying
// (NETWORK_ERROR) and giving up (TIMEOUT). With no model set up it returns the
// observed event, so the run is exactly the machine's own.
const FAILURE_CHOICES = ['NETWORK_ERROR', 'TIMEOUT'] as const

export function failureEvent(
  snap: SnapshotFrom<typeof fetchMachine>,
  aborted: boolean,
): Effect.Effect<FetchEvent> {
  const observed: FetchEvent = { type: aborted ? 'TIMEOUT' : 'NETWORK_ERROR' }
  const goal = `A fetch attempt failed with ${observed.type}. Pick the next event: one that retries, or one that gives up.`
  return Effect.map(
    decideAt(fetchMachine, snap, observed, goal, { choices: FAILURE_CHOICES }),
    (d) => (d.event ? ({ type: d.event } as FetchEvent) : observed),
  )
}
