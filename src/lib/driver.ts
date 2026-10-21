// Background page driver: one service, two back ends, never on the user's screen.
// - agent-browser (this file): its own headless Chrome; nothing is shown or focused.
// - cua (driver-cua.ts): the user's real signed-in Chrome, through cua-driver's
//   background delivery only.
// Each render is one session: Effect.acquireRelease opens it and always closes
// it, on success, failure, and interruption alike. The state stream lets a
// caller (a live view, a log) watch the session without polling.
import * as BunServices from '@effect/platform-bun/BunServices'
import { Context, Effect, Layer, Schema, type Stream, SubscriptionRef } from 'effect'
import { runBatch } from './agentbrowser.ts'

export const Backend = Schema.Literals(['agent-browser', 'cua'])
export type Backend = typeof Backend.Type

const SessionState = Schema.Struct({
  backend: Backend,
  phase: Schema.Literals(['idle', 'opening', 'reading', 'closed', 'failed']),
  url: Schema.optional(Schema.String),
})
type SessionState = typeof SessionState.Type

class DriverError extends Schema.TaggedError<DriverError>()('DriverError', {
  backend: Backend,
  message: Schema.String,
}) {}

interface Rendered {
  url: string
  html: string
}

export class Driver extends Context.Service<
  Driver,
  {
    readonly backend: Backend
    render(url: string): Effect.Effect<Rendered, DriverError>
    readonly state: Stream.Stream<SessionState>
  }
>()('webular/lib/Driver') {}

// One back end = how to open, read, and close a session on one url.
export interface Steps {
  open(url: string): Effect.Effect<unknown, DriverError>
  read(url: string, opened: unknown): Effect.Effect<string, DriverError>
  close(opened: unknown): Effect.Effect<void>
}

export const makeDriver = Effect.fnUntraced(function* (backend: Backend, steps: Steps) {
  const ref = yield* SubscriptionRef.make<SessionState>({ backend, phase: 'idle' })
  const mark = (phase: SessionState['phase'], url: string) =>
    SubscriptionRef.set(ref, { backend, phase, url })
  const session = (url: string) =>
    Effect.acquireRelease(Effect.andThen(mark('opening', url), steps.open(url)), (opened, exit) =>
      Effect.andThen(steps.close(opened), mark(exit._tag === 'Success' ? 'closed' : 'failed', url)),
    )
  const render = (url: string) =>
    Effect.scoped(
      Effect.gen(function* () {
        const opened = yield* session(url)
        yield* mark('reading', url)
        return { url, html: yield* steps.read(url, opened) }
      }),
    )
  return Driver.of({ backend, render, state: SubscriptionRef.changes(ref) })
})

export const driverError = (backend: Backend, message: string) =>
  new DriverError({ backend, message })

const decodeQuoted = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.String))

// agent-browser prints the page raw or as a JSON string; keep only the markup.
export const htmlFromAgentBrowser = (stdout: string) =>
  Effect.map(
    Effect.orElseSucceed(decodeQuoted(stdout.trim()), () => stdout),
    (text) => {
      const start = text.indexOf('<')
      const end = text.lastIndexOf('>')
      return start >= 0 && end > start ? text.slice(start, end + 1) : ''
    },
  )

const batch = (commands: string[][]) =>
  Effect.flatMap(
    runBatch(commands).pipe(
      Effect.mapError((err) => driverError('agent-browser', err.message)),
      Effect.provide(BunServices.layer),
    ),
    (res) =>
      res.code === 0
        ? Effect.succeed(res.stdout)
        : Effect.fail(driverError('agent-browser', res.stderr.trim() || `exit ${res.code}`)),
  )

const readHtml = () =>
  Effect.flatMap(Effect.flatMap(batch([['get', 'html', 'html']]), htmlFromAgentBrowser), (html) =>
    html ? Effect.succeed(html) : Effect.fail(driverError('agent-browser', 'empty page')),
  )

const agentBrowserSteps: Steps = {
  open: (url) => batch([['open', url]]),
  read: readHtml,
  close: () => Effect.ignore(batch([['close']])),
}

export const AgentBrowserLive = Layer.effect(Driver, makeDriver('agent-browser', agentBrowserSteps))
