// Agent contract for `webular mcp` over stdio. For every listed tool: its
// inputs match its CLI command's flags (one tool per command, same names),
// a fixture call returns a structured result, a bad input returns an isError
// result with a message, and command tools share the paging cursor.
import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { Effect, Schema } from 'effect'
import { useFixture } from '../_support/fixture.ts'
import { mcpHostEnv } from '../_support/mcp-env.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff, io } from '../_support/run.ts'
import { cliFlags, commonFlags } from './_mcp-flags.ts'

const RSS =
  '<rss version="2.0"><channel><title>F</title><item><title>One</title></item></channel></rss>'
const fx = useFixture((o) => ({
  ...defaultRoutes(o),
  '/feed.xml': () => new Response(RSS, { headers: { 'content-type': 'application/rss+xml' } }),
}))
const HTML = '<html><head><title>T</title></head><body><h1>Hi</h1><a href="/a">a</a></body></html>'

// CLI flags a tool leaves out on purpose, each with the reason.
const BUDGET = 'The tools/list token budget (tests/commands/tokens.test.ts) leaves no room for it.'
const CLI_ONLY: Record<string, Record<string, string>> = {
  batch: { archive: BUDGET },
  monitor: {
    db: 'The server picks the per-project database; an agent path could write anywhere.',
    'watch-for': BUDGET,
  },
  search: { variant: BUDGET },
}

// Tools with no fixture call, each with the reason.
const SKIP: Record<string, string> = {
  search: 'Queries outside search engines; tests/e2e runs it against their fixture routes.',
  answer: 'Runs a web search first; tests/e2e covers it.',
  research: 'Runs several web searches; tests/e2e covers it.',
  act: 'Drives a host browser binary.',
  doctor: 'Checks host binaries and the network.',
  media: 'Saves files and may drive a host browser; tests/e2e covers it.',
  monitor: 'Writes a per-project database on this computer.',
  jev: 'Reads and writes the recorded Jev calls on this computer; tests/jev covers it.',
  audit: 'Runs the repo audit, which is slow and reads the whole checkout.',
}

const CALLS: Record<string, (o: string) => Record<string, unknown>> = {
  'web.fetch': (o) => ({ url: `${o}/a` }),
  'web.links': (o) => ({ html: HTML, base: `${o}/` }),
  'web.markdown': () => ({ html: HTML }),
  'web.readability': () => ({ html: HTML }),
  scrape: (o) => ({ url: `${o}/a` }),
  map: (o) => ({ url: `${o}/`, limit: 5 }),
  crawl: (o) => ({ url: `${o}/`, limit: 2, depth: 1 }),
  extract: (o) => ({ url: `${o}/a`, selector: 'title' }),
  feed: (o) => ({ url: `${o}/feed.xml` }),
  summarize: () => ({ text: 'One fact. Two facts. Three facts. Four facts.' }),
  batch: (o) => ({ urls: [`${o}/a`, `${o}/b`] }),
  parse: () => ({ file: `${ROOT}package.json` }),
  diagram: () => ({}),
  tasks: () => ({}),
  'machine.next': () => ({ machine: 'fetch', events: [] }),
}

const connected = Effect.acquireRelease(
  Effect.gen(function* () {
    const host = yield* mcpHostEnv
    const client = new Client({ name: 'webular-contract', version: '0.0.0' })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [`${ROOT}src/commands/mcp.ts`],
      cwd: ROOT,
      env: { ...host, WEBULAR_NO_CACHE: '1', WEBULAR_SOURCE_ORIGIN: fx.origin },
      stderr: 'ignore',
    })
    return yield* io(() => client.connect(transport)).pipe(Effect.as(client))
  }),
  (client) => Effect.promise(() => client.close()),
)

const listed = connected.pipe(Effect.flatMap((c) => io(() => c.listTools())))
type ToolSchema = { properties?: Record<string, { type?: string }>; required?: string[] }
const decodeAny = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))
const decodeLinks = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Struct({ links: Schema.Array(Schema.String) })),
)
const decodeMore = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Struct({ nextCursor: Schema.String })),
)
const isCommand = (name: string) => !name.startsWith('web.') && name !== 'machine.next'
const textOf = (r: Record<string, unknown>) =>
  ((r['content'] ?? []) as { text?: string }[]).map((c) => c.text ?? '').join('\n')

describe('webular mcp — agent contract over stdio', () => {
  test(
    'each command tool takes exactly its CLI flags, plus the paging cursor',
    eff(
      Effect.gen(function* () {
        const common = yield* commonFlags
        for (const tool of (yield* listed).tools.filter((t) => isCommand(t.name))) {
          const schema = tool.inputSchema as ToolSchema
          const inputs = Object.keys(schema.properties ?? {}).filter((k) => k !== 'cursor')
          const flags = yield* cliFlags(tool.name)
          const extra = inputs.filter((k) => !flags.includes(k) && !common.includes(k))
          const missing = flags.filter((f) => !inputs.includes(f) && !CLI_ONLY[tool.name]?.[f])
          expect([tool.name, extra, missing]).toEqual([tool.name, [], []])
          for (const key of schema.required ?? []) expect([...flags, ...common]).toContain(key)
          expect(schema.properties?.['cursor']?.type).toBe('integer')
        }
      }),
    ),
    20_000,
  )

  test(
    'every tool has a fixture call or a recorded reason to skip it',
    eff(
      Effect.gen(function* () {
        const names = (yield* listed).tools.map((t) => t.name)
        const unclassified = names.filter((n) => !(n in CALLS) === !(n in SKIP))
        expect(unclassified).toEqual([])
      }),
    ),
    20_000,
  )

  test(
    'a fixture call returns a structured result',
    eff(
      Effect.gen(function* () {
        const client = yield* connected
        const call = ([name, args]: [string, (o: string) => Record<string, unknown>]) =>
          io(() => client.callTool({ name, arguments: args(fx.origin) })).pipe(
            Effect.map((r) => ({ name, r })),
          )
        const results = yield* Effect.forEach(Object.entries(CALLS), call, { concurrency: 4 })
        for (const { name, r } of results) {
          expect({ name, isError: r.isError ?? false, text: r.isError ? textOf(r) : '' }).toEqual({
            name,
            isError: false,
            text: '',
          })
          const structured = isCommand(name)
            ? r.structuredContent
            : yield* decodeAny(textOf(r).split('\n')[0] ?? '')
          expect(typeof structured).toBe('object')
          expect(structured).not.toBeNull()
        }
      }),
    ),
    60_000,
  )

  test(
    'a bad input returns an isError result with a clear message',
    eff(
      Effect.gen(function* () {
        const client = yield* connected
        const { tools } = yield* io(() => client.listTools())
        const bad = (name: string) =>
          io(() =>
            client.callTool({ name, arguments: { cursor: 'not-a-cursor', url: 'not a url' } }),
          ).pipe(Effect.map((r) => ({ name, isError: r.isError, clear: textOf(r).length > 10 })))
        const results = yield* Effect.forEach(tools, (t) => bad(t.name), { concurrency: 4 })
        for (const r of results) expect(r).toEqual({ name: r.name, isError: true, clear: true })
      }),
    ),
    30_000,
  )

  test(
    'following nextCursor to the end returns every item once',
    eff(
      Effect.gen(function* () {
        const client = yield* connected
        const want = Array.from({ length: 1000 }, (_, i) => `${fx.origin}/p/${i}`)
        const html = want.map((u) => `<a href="${u}">x</a>`).join('')
        const texts: string[] = []
        let cursor: string | undefined
        do {
          const args = { html, base: `${fx.origin}/`, limit: 1000, ...(cursor && { cursor }) }
          const r = yield* io(() => client.callTool({ name: 'web.links', arguments: args }))
          expect(r.isError ?? false).toBe(false)
          const [page, more] = (r.content as { text: string }[]).map((c) => c.text)
          texts.push(page ?? '')
          cursor = more === undefined ? undefined : (yield* decodeMore(more)).nextCursor
        } while (cursor !== undefined)
        const got = (yield* decodeLinks(texts.join(''))).links
        expect(texts.length).toBeGreaterThan(1)
        expect(new Set(got).size).toBe(got.length)
        expect([...got].sort()).toEqual([...want].sort())
      }),
    ),
    30_000,
  )
})
