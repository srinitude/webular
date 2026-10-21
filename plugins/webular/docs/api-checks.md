# Webular plugin: API checks against upstream

Each API the plugin calls was read in upstream source or in the installed package source. Each line names the API, where it lives, and whether the plugin uses it the way the source says.

## Packages checked

- `@mastra/core@1.78.0` and `@mastra/mcp@2.4.1`, read from the installed source maps and type files.
- `@modelcontextprotocol/client@2.2.0`, `core@2.2.0`, `server@2.2.0`, and `node@2.0.0`, which `@mastra/mcp` pulls in (`package.json:28-32`).
- `effect@4.0.5` and `@effect/platform-bun@4.0.5`, from github.com/Effect-TS/effect branch `main` (`packages/effect`, `packages/platform/bun`).
- `zod@4.6.7`, `bun-types@1.4.3`, `mise@2026.9.13`, and `portless@0.15.8`.
- MCP spec: github.com/modelcontextprotocol/modelcontextprotocol, `docs/specification/2026-07-28/basic/transports/streamable-http.mdx`.
- Agent Skills spec: github.com/agentskills/agentskills, `skills-ref/src/skills_ref/validator.py`.

## Mastra and MCP

- `createTool`: `core/dist/tools/tool.d.ts:329`. Matches.
- `createTool` fields `id`, `description`, `inputSchema`: `core/dist/tools/types.d.ts:613-619`. `execute(input, context)` is at `:612` and `context.abortSignal` at `:554`. Matches.
- `MCPServer` constructor: `mcp/src/server/server.ts:180`, with its config in `core/dist/mcp/types.d.ts:241-262`. The key in the `tools` record is the tool name (`convertTools`, `:217`). Matches.
- `MCPServer.startStdio()`: `mcp/src/server/server.ts:1110`. Matches.
- `MCPServer.startHTTP({ url, httpPath, req, res })`: `mcp/src/server/server.ts:1128`, typed at `dist/server/server.d.ts:22`. `url` is a `URL`. Matches.
- `MCPClient({ servers: { name: { url } } })`: `mcp/src/client/configuration.ts:101,146`. HTTP needs `url: URL` (`client/types.ts:396`). Matches.
- `MCPClient.listTools()`: `client/configuration.ts:978`. Tool names are `${serverName}_${toolName}` (`:1030`). Matches.
- `MCPClient.disconnect()`: `client/configuration.ts:662`. Matches.
- The abort signal reaches the tool: `server/server.ts:821-829` passes `options.mcp?.extra.signal`. Matches.
- Streamable HTTP uses one POST endpoint. The client sends `Accept` with JSON and SSE, and `MCP-Protocol-Version` on every POST (spec `:47-91`, `:252-259`). `@mastra/mcp` builds its handler with `legacy: 'reject'` (`server/server.ts:1098-1099`). A client on an earlier protocol gets a rejection, so it uses the stdio entry.
- Origin check: the spec says servers MUST validate `Origin` (`:58-61`). `startHTTP` takes `options.enableDnsRebindingProtection`, `allowedOrigins`, and `allowedHosts` (`dist/server/types.d.ts:96-114`). The server binds to `127.0.0.1` only.

## Effect and the Bun platform

- `ManagedRuntime.make`: `ManagedRuntime.ts:325`. Matches.
- In `packages/effect/src/Effect.ts`: `Effect.gen` `:1497`, `scoped` `:6747`, `all` `:507`, `try` `:1782`, `tryPromise` `:1008`, `callback` `:1288`, `acquireRelease` `:6862`, `acquireUseRelease` `:6996`, `retry` `:4273`, `filterOrFail` `:5390`, `runPromise` `:9402`, `runFork` `:9216`, `forEach` `:798`, `mapError` `:3768`, `logInfo` `:14249`. All match.
- `runPromise({ signal })`: `RunOptions.signal`, and `ManagedRuntime.runPromise` takes it. Matches.
- `Data.TaggedError`: `Data.ts:769`. Matches.
- `Config.Port` `Config.ts:1405` and `Config.withDefault` `:486`. Both match. `Config.String` is in the installed `effect/dist/Config.d.ts:1004`. Matches.
- `Stream.decodeText` `Stream.ts:9875` and `Stream.mkString` `:11549`. Both match.
- `Schema.Struct` `Schema.ts:3589`, `fromJsonString` `:9835`, `decodeUnknownEffect` `:1527`, `Top` `:768`. All match.
- `FileSystem.readFileString` `FileSystem.ts:259` and `readDirectory` `:244`. Both match.
- `Random.nextIntBetween` `Random.ts:199` and `Schedule.spaced` `Schedule.ts:1231`. Both match.
- `ChildProcess.make(cmd, args, { env, extendEnv })`: `process/ChildProcess.ts:633`, options at `:427`. Matches.
- `ChildProcessSpawner.spawn` `process/ChildProcessSpawner.ts:266` and `string` `:303`. Both match.
- `BunRuntime.runMain`: `packages/platform/bun/src/BunRuntime.ts:40`. `BunServices.layer`: `BunServices.ts:44`. Both match.

## Bun, mise, and zod

- `Bun.argv` `bun.d.ts:796`, `Bun.which` `:820`, `import.meta.main` `globals.d.ts:1405`, and `test.skipIf` in `test.d.ts`. All match.
- `node:http` `createServer` under Bun: `src/js/node/http.ts:16`. Matches.
- mise `depends` arrays: `docs/tasks/task-configuration.md:352` and `src/task/mod.rs:343`. `{{config_root}}`: `task-configuration.md:164`. Both match. Tasks in one `depends` array run in parallel (`docs/tasks/architecture.md:134`), so `default` runs the repo spine and the plugin chain side by side.
- In `packages/zod/src/v4/classic/schemas.ts`: `z.object` `:1731`, `z.string().min()` `:617` and `:372`, `z.number().int().min().max()` `:1222` and `:1121`, `.optional()` `:119`, `.describe()` `:142`. All match.
- zod `z.string().url()` is deprecated (`schemas.ts:457`). `z.httpUrl()` (`:772`) rejects `localhost`, which the tests serve on, so the plugin uses `z.url({ protocol: /^https?$/ })`.
