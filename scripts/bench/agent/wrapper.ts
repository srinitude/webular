// Thin MCP stdio server for a web provider with no official MCP server. It gives
// that provider the same answer/fetch/search tools as the peer arms.
// Usage: bun scripts/bench/agent/wrapper.ts <provider>   (provider: jina)
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Config, Effect, Option, Redacted } from 'effect'
import { z } from 'zod'
import { EXIT } from '../../../src/cli/exit-codes.ts'
import { CliError, runMain } from '../../../src/core/effect.ts'
import { fetchText } from '../../../src/core/http.ts'
import { errMsg } from '../../../src/core/output.ts'

const fail = (message: string) => new CliError({ message, exitCode: EXIT.failure })

// Optional key, sent as a Bearer token; Jina serves keyless calls at a lower rate.
const jinaGet = (url: string) =>
  Effect.gen(function* () {
    const key = yield* Config.option(Config.Redacted('JINA_API_KEY')).pipe(
      Effect.orElseSucceed(() => Option.none<Redacted.Redacted<string>>()),
    )
    const headers = Option.match(key, {
      onNone: () => ({}),
      onSome: (k) => ({ authorization: `Bearer ${Redacted.value(k)}` }),
    })
    return yield* fetchText(url, { headers, timeoutMs: 60_000, cache: false })
  })

const search = (q: string | undefined) => `https://s.jina.ai/?q=${encodeURIComponent(q ?? '')}`

interface Tool {
  readonly description: string
  readonly schema: z.ZodObject
  readonly url: (args: Record<string, string>) => string
}

// Same three tools as the peer arms, in id order.
const JINA: Readonly<Record<string, Tool>> = {
  answer: {
    description: 'Answer a question using web search; returns the ranked result text.',
    schema: z.object({ question: z.string() }),
    url: (a) => search(a['question']),
  },
  fetch: {
    description: 'Fetch a web page by its URL; returns the page text as readable markdown.',
    schema: z.object({ url: z.string() }),
    url: (a) => `https://r.jina.ai/${a['url'] ?? ''}`,
  },
  search: {
    description: 'Search the web for a query; returns the top results with their page text.',
    schema: z.object({ query: z.string() }),
    url: (a) => search(a['query']),
  },
}

const PROVIDERS: Readonly<Record<string, Readonly<Record<string, Tool>>>> = { jina: JINA }

// The descriptions stay within 10% of each other in length, so no tool reads as
// the more important one to the model.
const lengthCheck = Effect.gen(function* () {
  const sizes = Object.values(JINA).map((t) => t.description.length)
  if (Math.max(...sizes) / Math.min(...sizes) > 1.1)
    return yield* Effect.fail(fail(`wrapper: tool descriptions differ by over 10% (${sizes})`))
})

const load = <M>(run: () => Promise<M>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => fail(`wrapper: the server failed (${errMsg(cause)})`),
  })

const reply = (text: string, isError = false) => ({
  content: [{ type: 'text' as const, text }],
  isError,
})

const register = Effect.fn('register')(function* (
  server: McpServer,
  tools: Readonly<Record<string, Tool>>,
) {
  const runWith = Effect.runPromiseWith(yield* Effect.context<never>())
  for (const [id, tool] of Object.entries(tools)) {
    const call = (args: Record<string, string>) =>
      jinaGet(tool.url(args)).pipe(
        Effect.map((body) => reply(body)),
        Effect.catch((err) => Effect.succeed(reply(errMsg(err), true))),
      )
    const config = { description: tool.description, inputSchema: tool.schema.shape }
    server.registerTool(id, config, (args) => runWith(call(args as Record<string, string>)))
  }
})

const serve = (tools: Readonly<Record<string, Tool>>) =>
  Effect.gen(function* () {
    const { McpServer } = yield* load(() => import('@modelcontextprotocol/sdk/server/mcp.js'))
    const { StdioServerTransport } = yield* load(
      () => import('@modelcontextprotocol/sdk/server/stdio.js'),
    )
    const server = yield* Effect.acquireRelease(
      Effect.sync(() => new McpServer({ name: 'webular-bench-wrapper', version: '0.0.0' })),
      (s) => Effect.tryPromise(() => s.close()).pipe(Effect.ignore),
    )
    yield* register(server, tools)
    yield* load(() => server.connect(new StdioServerTransport()))
    // The stdio transport never closes on stdin EOF, so end on either signal.
    yield* Effect.callback<void>((resume) => {
      const done = () => resume(Effect.void)
      server.server.onclose = done
      process.stdin.once('end', done)
      return Effect.sync(() => process.stdin.off('end', done))
    })
    return 0
  }).pipe(Effect.scoped)

const main = Effect.gen(function* () {
  yield* lengthCheck
  const name = Bun.argv[2] ?? ''
  const tools = PROVIDERS[name]
  if (tools === undefined)
    return yield* Effect.fail(fail(`wrapper: unknown provider '${name}' (known: jina)`))
  return yield* serve(tools)
})

runMain(main)
