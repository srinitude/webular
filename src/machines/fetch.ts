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
import { assign, type EventFromLogic, type SnapshotFrom, setup } from 'xstate'
import { MAX_RETRIES, REDIRECT_LIMIT, RETRY_ON_TIMEOUT } from '../core/fetch-policy.ts'
import { decideAt } from './agent.ts'

export const fetchMachine = setup({
  types: {
    context: {} as { attempt: number; hops: number },
    events: {} as
      | { type: 'OK' }
      | { type: 'HTTP_ERROR' }
      | { type: 'RETRYABLE_STATUS' }
      | { type: 'NETWORK_ERROR' }
      | { type: 'TIMEOUT' }
      | { type: 'REDIRECT_SAME_HOST' }
      | { type: 'REDIRECT_OFF_HOST' },
  },
  guards: {
    retryStatus: ({ context }) => context.attempt < MAX_RETRIES,
    retryNetwork: ({ context }) => context.attempt < MAX_RETRIES,
    retryTimeout: ({ context }) => RETRY_ON_TIMEOUT && context.attempt < MAX_RETRIES,
    canFollow: ({ context }) => context.hops < REDIRECT_LIMIT - 1,
  },
  actions: {
    countRetry: assign({ attempt: ({ context }) => context.attempt + 1 }),
    followRedirect: assign({ hops: ({ context }) => context.hops + 1, attempt: 0 }),
  },
}).createMachine({
  id: 'fetch',
  context: { attempt: 0, hops: 0 },
  initial: 'requesting',
  states: {
    requesting: {
      on: {
        OK: 'succeeded',
        HTTP_ERROR: 'httpFailed',
        RETRYABLE_STATUS: [
          { guard: 'retryStatus', target: 'requesting', reenter: true, actions: 'countRetry' },
          { target: 'httpFailed' },
        ],
        NETWORK_ERROR: [
          { guard: 'retryNetwork', target: 'requesting', reenter: true, actions: 'countRetry' },
          { target: 'networkFailed' },
        ],
        TIMEOUT: [
          { guard: 'retryTimeout', target: 'requesting', reenter: true, actions: 'countRetry' },
          { target: 'timedOut' },
        ],
        REDIRECT_SAME_HOST: [
          { guard: 'canFollow', target: 'requesting', reenter: true, actions: 'followRedirect' },
          { target: 'tooManyRedirects' },
        ],
        REDIRECT_OFF_HOST: 'offHostBlocked',
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
