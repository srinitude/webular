// Real TCP server that answers each new connection with the next scripted
// reply: an HTTP response, a dropped connection, or silence (a hang). Lets
// tests drive the fetch layer through network errors and timeouts. The server
// is owned by the enclosing Scope: it stops when the scope closes.
// A hang also fires the run's timeout signal the moment the hung request
// arrives, so a timeout never races wall time: requests that answer have no
// deadline to miss under load, and the hung one times out exactly once.
import { Effect, type Scope } from 'effect'

export type Reply = { status: number; location?: string } | 'drop' | 'hang'

export interface ScriptedServer {
  origin: string
  // Queues the replies and returns the signal a hang aborts with a TimeoutError.
  play(replies: Reply[]): AbortSignal
  served(): number
  stop(): void
}

function httpText(reply: { status: number; location?: string }): string {
  const location = reply.location ? `Location: ${reply.location}\r\n` : ''
  return `HTTP/1.1 ${reply.status} X\r\nContent-Type: text/plain\r\n${location}Content-Length: 2\r\nConnection: close\r\n\r\nok`
}

function answer(
  socket: { write(text: string): unknown; end(): void },
  reply: Reply,
  timeout: AbortController,
): void {
  if (reply === 'hang') {
    timeout.abort(new DOMException('The operation timed out.', 'TimeoutError'))
    return
  }
  if (reply !== 'drop') socket.write(httpText(reply))
  socket.end()
}

const listen = (): ScriptedServer => {
  let queue: Reply[] = []
  let count = 0
  let timeout = new AbortController()
  const server = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      data(socket) {
        count++
        answer(socket, queue.shift() ?? 'drop', timeout)
      },
    },
  })
  return {
    origin: `http://127.0.0.1:${server.port}`,
    play: (replies) => {
      queue = [...replies]
      count = 0
      timeout = new AbortController()
      return timeout.signal
    },
    served: () => count,
    stop: () => server.stop(true),
  }
}

export const startScriptedServer = (): Effect.Effect<ScriptedServer, never, Scope.Scope> =>
  Effect.acquireRelease(Effect.sync(listen), (server) => Effect.sync(() => server.stop()))
