// Writes src/generated/tools.json from the live `webular mcp` tools/list reply,
// so the /tools page and /tools.json never drift from the server.
import { BunFileSystem, BunRuntime } from '@effect/platform-bun'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js'
import { Console, Effect, FileSystem } from 'effect'

const REPO = new URL('../../', import.meta.url).pathname
const OUT = new URL('../src/generated/', import.meta.url).pathname

const connect = Effect.acquireRelease(
  Effect.tryPromise(async () => {
    const client = new Client({ name: 'webular-dev-site', version: '0.0.0' })
    const transport = new StdioClientTransport({
      command: 'bun',
      args: [`${REPO}bin/webular.ts`, 'mcp'],
      cwd: REPO,
      env: { ...getDefaultEnvironment(), WEBULAR_DEV: '1' },
    })
    await client.connect(transport)
    return client
  }),
  (client) => Effect.promise(() => client.close()),
)

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const client = yield* connect
  const { tools } = yield* Effect.tryPromise(() => client.listTools())
  const kept = tools.map(({ name, title, description, inputSchema, annotations }) => ({
    name,
    title,
    description,
    inputSchema,
    annotations,
  }))
  yield* fs.makeDirectory(OUT, { recursive: true })
  yield* fs.writeFileString(`${OUT}tools.json`, `${JSON.stringify(kept, null, 2)}\n`)
  yield* Console.log(`tools.json: ${kept.length} tools`)
})

program.pipe(
  Effect.scoped,
  Effect.tapError((e) => Console.error(`site tools.json failed: ${String(e)}`)),
  Effect.provide(BunFileSystem.layer),
  BunRuntime.runMain,
)
