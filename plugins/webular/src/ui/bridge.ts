// The MCP Apps host bridge, as an Effect: send ui/initialize, confirm with
// ui/notifications/initialized, then route tool-input, tool-result, and
// tool-cancelled notifications. Interrupting the fiber removes the listener.
import { Effect, Queue, Stream } from 'effect'
import type { SessionResult } from './lifecycle.ts'

interface ToolResult {
  readonly content?: ReadonlyArray<{ readonly type: string; readonly text?: string }>
  readonly structuredContent?: SessionResult
  readonly isError?: boolean
}

// Every webular tool has an output schema, so a good result carries structuredContent.
export const readResult = (r: ToolResult): SessionResult => {
  const text = r.content?.find((c) => c.type === 'text')?.text ?? ''
  return r.isError || !r.structuredContent ? { error: true, message: text } : r.structuredContent
}

const post = (message: object) =>
  Effect.sync(() => window.parent.postMessage({ jsonrpc: '2.0', ...message }, '*'))

// ponytail: a 64-message buffer that drops the oldest; a run sends three or four.
const hostMessages = Stream.callback<MessageEvent>(
  (queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const listener = (e: MessageEvent) => {
          if (e.source === window.parent && e.data?.jsonrpc === '2.0') Queue.offerUnsafe(queue, e)
        }
        window.addEventListener('message', listener)
        return listener
      }),
      (listener) => Effect.sync(() => window.removeEventListener('message', listener)),
    ),
  { bufferSize: 64, strategy: 'sliding' },
)

export interface Handlers {
  readonly onStart: () => void
  readonly onResult: (r: SessionResult) => void
}

const route = (e: MessageEvent, h: Handlers) => {
  const { id, method, params } = e.data
  if (id === 1 && 'result' in e.data) return post({ method: 'ui/notifications/initialized' })
  if (method === 'ui/notifications/tool-input') return Effect.sync(h.onStart)
  if (method === 'ui/notifications/tool-result')
    return Effect.sync(() => h.onResult(readResult(params)))
  if (method === 'ui/notifications/tool-cancelled')
    return Effect.sync(() => h.onResult({ error: true, message: 'The host cancelled this run.' }))
  return Effect.void
}

const initialize = post({
  id: 1,
  method: 'ui/initialize',
  params: {
    protocolVersion: '2026-01-26',
    appInfo: { name: 'webular-session', version: '1.0.0' },
    appCapabilities: {},
  },
})

// Listens first, then starts the handshake, so the host reply is never missed.
export const connectHost = (h: Handlers) =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.forkScoped(Stream.runForEach(hostMessages, (e) => route(e, h)))
      yield* Effect.yieldNow
      yield* initialize
      return yield* Effect.never
    }),
  )
