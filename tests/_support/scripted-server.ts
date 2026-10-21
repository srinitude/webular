// Real TCP server that answers each new connection with the next scripted
// reply: an HTTP response, a dropped connection, or silence (a hang). Lets
// tests drive the fetch layer through network errors and timeouts.
export type Reply = { status: number; location?: string } | 'drop' | 'hang'

export interface ScriptedServer {
  origin: string
  play(replies: Reply[]): void
  served(): number
  stop(): void
}

function httpText(reply: { status: number; location?: string }): string {
  const location = reply.location ? `Location: ${reply.location}\r\n` : ''
  return `HTTP/1.1 ${reply.status} X\r\nContent-Type: text/plain\r\n${location}Content-Length: 2\r\nConnection: close\r\n\r\nok`
}

export function startScriptedServer(): ScriptedServer {
  let queue: Reply[] = []
  let count = 0
  const server = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      data(socket) {
        count++
        const reply = queue.shift() ?? 'drop'
        if (reply === 'hang') return
        if (reply !== 'drop') socket.write(httpText(reply))
        socket.end()
      },
    },
  })
  return {
    origin: `http://127.0.0.1:${server.port}`,
    play: (replies) => {
      queue = [...replies]
      count = 0
    },
    served: () => count,
    stop: () => server.stop(true),
  }
}
