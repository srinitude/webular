// Shared harness for the MCP outcome evals: one local site and one real stdio
// MCP client talking to the real server. No mocks.
import { MCPClient } from '@mastra/mcp'
import { Effect, Random } from 'effect'
import { runtime } from '../src/runtime.ts'

const serverPath = new URL('../src/server.ts', import.meta.url).pathname
const page = `<html><head><title>Webular test page</title>
<link rel="alternate" type="application/rss+xml" href="/posts.xml"></head><body><article>
<h1>Webular test page</h1><p>Webular turns web pages into clean text for agents.</p>
<p>It runs every command as a typed tool.</p><a href="/second">Second page</a></article></body></html>`
const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>Webular posts</title>
<item><title>First post</title><link>https://example.com/first</link></item></channel></rss>`

// The page links its feed at /posts.xml; every other path gets the page.
const respond = (req: Request) =>
  new URL(req.url).pathname === '/posts.xml'
    ? new Response(feed, { headers: { 'content-type': 'application/rss+xml' } })
    : new Response(page, { headers: { 'content-type': 'text/html' } })

export type Tools = Record<
  string,
  {
    execute?: (input: unknown, ctx?: unknown) => Promise<unknown>
    mcp?: { annotations?: { title?: string; readOnlyHint?: boolean; openWorldHint?: boolean } }
  }
>

const open = (n: number) =>
  Effect.sync(() => ({
    site: Bun.serve({ port: 0, maxRequestBodySize: 1024, fetch: respond }),
    // A unique id per client, so a client left behind never blocks the next one.
    client: new MCPClient({
      id: `webular-test-${n}`,
      servers: { webular: { command: 'bun', args: [serverPath] } },
    }),
  }))

// One local site plus one stdio MCP client, both released after `use`.
const withServer = <A>(use: (tools: Tools, site: URL) => Effect.Effect<A, unknown>) =>
  Effect.acquireUseRelease(
    Effect.flatMap(Random.nextInt, open),
    ({ site, client }) =>
      Effect.tryPromise(() => client.listTools()).pipe(
        Effect.flatMap((tools) => use(tools as Tools, site.url)),
      ),
    ({ site, client }) =>
      Effect.promise(() => client.disconnect()).pipe(
        Effect.andThen(Effect.promise(() => site.stop(true))),
      ),
  )

export const call = (tools: Tools, name: string, input: unknown) =>
  Effect.tryPromise({
    try: () => {
      const tool = tools[`webular_${name}`]
      if (!tool?.execute) return Promise.reject(new Error(`no tool ${name}`))
      return tool.execute(input, {})
    },
    catch: String,
  }).pipe(Effect.map((result) => JSON.stringify(result)))

// The deadline sits under bun's test timeout, so a slow test is interrupted
// inside acquireUseRelease and its client still disconnects.
export const run = <A>(use: (tools: Tools, site: URL) => Effect.Effect<A, unknown>) =>
  runtime.runPromise(withServer(use).pipe(Effect.timeout('25 seconds')))
