// The MCP Apps host bridge, as an Effect: send ui/initialize, confirm with
// ui/notifications/initialized, then route tool-input, tool-result,
// tool-cancelled, and host-context-changed notifications. Page clicks (Re-run,
// Copy as text) queue up and run on this fiber. Interrupting the fiber removes
// the listener.
import { Clock, Effect, Queue, Stream } from 'effect'
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

const send = (message: object) => window.parent.postMessage({ jsonrpc: '2.0', ...message }, '*')
const post = (message: object) => Effect.sync(() => send(message))

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

// A copy request: the text, and who hears whether the clipboard write worked.
export type Copy = (text: string, done: (ok: boolean) => void) => void

export interface Handlers {
  // `at` is the Effect clock reading, in ms, when the run started or its result arrived.
  readonly onStart: (at: number) => void
  readonly onResult: (r: SessionResult, at: number) => void
  // Called once the tool name and arguments are known; the view shows Re-run then.
  readonly onRerunReady: (rerun: () => void) => void
  readonly onCopyReady: (copy: Copy) => void
}

// The tool call this view renders, learned from the handshake and tool-input,
// and the queue page clicks go through.
interface Call {
  name?: string
  args?: unknown
  id: number
  readonly clicks: Queue.Queue<Effect.Effect<void>>
}

const stamped = (f: (at: number) => void) =>
  Effect.flatMap(Clock.currentTimeMillis, (at) => Effect.sync(() => f(at)))

const rerunOf = (call: Call, h: Handlers) => () =>
  Queue.offerUnsafe(
    call.clicks,
    stamped((at) => {
      h.onStart(at)
      call.id++
      send({ id: call.id, method: 'tools/call', params: { name: call.name, arguments: call.args } })
    }),
  )

const onInput = (call: Call, h: Handlers, args: unknown, at: number) => {
  call.args = args
  h.onStart(at)
  if (call.name && args) h.onRerunReady(rerunOf(call, h))
}

// The host's theme drives the page's color-scheme; without one the system theme holds.
const applyTheme = (context?: { theme?: string }) => {
  if (context?.theme === 'light' || context?.theme === 'dark')
    document.documentElement.dataset.theme = context.theme
}

const route = (e: MessageEvent, h: Handlers, call: Call) => {
  const { id, method, params, result } = e.data
  if (id === 1 && result) {
    call.name = result.hostContext?.toolInfo?.tool?.name
    applyTheme(result.hostContext)
    return post({ method: 'ui/notifications/initialized' })
  }
  if (method === 'ui/notifications/host-context-changed')
    return Effect.sync(() => applyTheme(params))
  if (id > 1 && result) return stamped((at) => h.onResult(readResult(result), at))
  if (method === 'ui/notifications/tool-input')
    return stamped((at) => onInput(call, h, params?.arguments, at))
  if (method === 'ui/notifications/tool-result')
    return stamped((at) => h.onResult(readResult(params), at))
  if (method === 'ui/notifications/tool-cancelled')
    return stamped((at) => h.onResult({ error: true, message: 'The host cancelled this run.' }, at))
  return Effect.void
}

// "Copied" only once the clipboard write resolves; a denied write reports false.
const copyOf =
  (call: Call): Copy =>
  (text, done) =>
    Queue.offerUnsafe(
      call.clicks,
      Effect.tryPromise(() => navigator.clipboard.writeText(text)).pipe(
        Effect.match({ onSuccess: () => done(true), onFailure: () => done(false) }),
      ),
    )

const initialize = post({
  id: 1,
  method: 'ui/initialize',
  params: {
    protocolVersion: '2026-01-26',
    appInfo: { name: 'webular-view', version: '1.0.0' },
    appCapabilities: {},
  },
})

// Listens first, then starts the handshake, so the host reply is never missed.
export const connectHost = (h: Handlers) =>
  Effect.scoped(
    Effect.gen(function* () {
      // ponytail: 8 pending clicks, oldest dropped; a person clicks one at a time.
      const call: Call = { id: 1, clicks: yield* Queue.sliding<Effect.Effect<void>>(8) }
      yield* Effect.forkScoped(Stream.runForEach(Stream.fromQueue(call.clicks), (click) => click))
      h.onCopyReady(copyOf(call))
      yield* Effect.forkScoped(Stream.runForEach(hostMessages, (e) => route(e, h, call)))
      yield* Effect.yieldNow
      yield* initialize
      return yield* Effect.never
    }),
  )
