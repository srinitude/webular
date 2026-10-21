// Fetch path (src/core/http.ts): each request gets a per-attempt timeout;
// 429/502/503/504 and network errors retry on a fixed backoff (two retries);
// a timeout never retries. In host-scoped fetches (fetchTextWithinHost) a
// same-host redirect starts a fresh request with fresh retries, an off-host
// redirect is blocked, and the fifth redirect fails.
// Fallback chains from the reliable-sources work would extend `succeeded`'s
// siblings: each failed final state would gain a "try next source" transition
// back to `requesting` with the next source in context.
import { assign, setup } from 'xstate'

const MAX_RETRIES = 2
const MAX_FOLLOWED_REDIRECTS = 4

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
    canRetry: ({ context }) => context.attempt < MAX_RETRIES,
    canFollow: ({ context }) => context.hops < MAX_FOLLOWED_REDIRECTS,
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
          { guard: 'canRetry', target: 'requesting', reenter: true, actions: 'countRetry' },
          { target: 'httpFailed' },
        ],
        NETWORK_ERROR: [
          { guard: 'canRetry', target: 'requesting', reenter: true, actions: 'countRetry' },
          { target: 'networkFailed' },
        ],
        TIMEOUT: 'timedOut',
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
