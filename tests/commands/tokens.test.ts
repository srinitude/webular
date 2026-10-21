// Token budgets, cache stability, and determinism for the MCP server and the
// CLI. Budgets fail on regression; raise one only with a measured reason.
import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Effect, Schema } from 'effect'
import { estimateTokens, PAGE_MAX_CHARS } from '../../src/core/output.ts'
import { registerAll } from '../../src/tools/web.ts'
import { runCli } from '../_support/cli.ts'

const BUDGET = { toolsList: 520, page: estimateTokens('x'.repeat(PAGE_MAX_CHARS)), error: 80 }
const parseJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))
const parseRec = (text: string): Record<string, unknown> =>
  parseJson(text) as Record<string, unknown>
const run = <A>(body: Effect.Effect<A>): Promise<A> => Effect.runPromise(body)

const connected = Effect.gen(function* () {
  const server = new McpServer({ name: 'webular-test', version: '0.0.0' })
  registerAll(server)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  yield* Effect.promise(() => server.connect(serverTransport))
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  yield* Effect.promise(() => client.connect(clientTransport))
  return client
})

type Texts = { type: string; text: string }[]
const texts = (r: unknown): string[] =>
  (((r as { content?: unknown }).content ?? []) as Texts).map((c) => c.text)
const call = (client: Client, name: string, args: Record<string, unknown>) =>
  Effect.promise(() => client.callTool({ name, arguments: args }))
const bigHtml = `<html><body>${'<p><a href="/x">link</a> some words here.</p>'.repeat(1000)}</body></html>`
const smallHtml = '<title>T</title><p>Body.</p>'

describe('MCP — cache-stable tool list', () => {
  test('tools/list is sorted, byte-identical across servers, and within budget', () =>
    run(
      Effect.gen(function* () {
        const [a, b] = yield* Effect.all([connected, connected])
        const la = yield* Effect.promise(() => a.listTools())
        const lb = yield* Effect.promise(() => b.listTools())
        const bytes = JSON.stringify(la.tools)
        expect(bytes).toBe(JSON.stringify(lb.tools))
        const names = la.tools.map((t) => t.name)
        expect(names).toEqual([...names].sort())
        expect(estimateTokens(bytes)).toBeLessThanOrEqual(BUDGET.toolsList)
      }),
    ))
})

const collectPages = (client: Client) =>
  Effect.gen(function* () {
    const pages: string[] = []
    let cursor: string | undefined
    do {
      const [body = '', more] = texts(
        yield* call(client, 'web.markdown', { html: bigHtml, cursor }),
      )
      expect(estimateTokens(body)).toBeLessThanOrEqual(BUDGET.page)
      pages.push(body)
      cursor = more ? String(parseRec(more).nextCursor) : undefined
    } while (cursor)
    return pages
  })

describe('MCP — compact, paged, deterministic results', () => {
  test('a large result pages losslessly under the page budget', () =>
    run(
      Effect.gen(function* () {
        const pages = yield* collectPages(yield* connected)
        expect(pages.length).toBeGreaterThan(1)
        expect(String(parseRec(pages.join('')).markdown)).toContain('some words here.')
      }),
    ))

  test('same call twice gives identical bytes; JSON is compact', () =>
    run(
      Effect.gen(function* () {
        const client = yield* connected
        const one = texts(yield* call(client, 'web.readability', { html: smallHtml }))
        const two = texts(yield* call(client, 'web.readability', { html: smallHtml }))
        expect(one).toEqual(two)
        expect(one[0]).not.toContain('\n  ')
      }),
    ))

  test('fields and limit narrow the result', () =>
    run(
      Effect.gen(function* () {
        const client = yield* connected
        const html = '<a href="/a">a</a><a href="/b">b</a>'
        const links = yield* call(client, 'web.links', { html, base: 'https://e.test/', limit: 1 })
        expect(parseRec(texts(links)[0] ?? '')).toEqual({ links: ['https://e.test/a'] })
        const picked = yield* call(client, 'web.readability', {
          html: smallHtml,
          fields: ['title'],
        })
        expect(Object.keys(parseRec(texts(picked)[0] ?? ''))).toEqual(['title'])
      }),
    ))

  test('errors are one short line', () =>
    run(
      Effect.gen(function* () {
        const r = yield* call(yield* connected, 'web.markdown', { html: 'x', cursor: 'bad' })
        expect(r.isError).toBe(true)
        expect(estimateTokens(texts(r)[0] ?? '')).toBeLessThanOrEqual(BUDGET.error)
      }),
    ))
})

const cli = (args: string[]) => Effect.promise(() => runCli('/bin/webular.ts', args))

describe('CLI — piped output is compact, sorted, colorless, repeatable', () => {
  test(
    '--json off a TTY is one line; two runs match byte for byte',
    () =>
      run(
        Effect.gen(function* () {
          const [one, two] = yield* Effect.all([
            cli(['diagram', '--json']),
            cli(['diagram', '--json']),
          ])
          expect(one.code).toBe(0)
          expect(one.out).toBe(two.out)
          expect(one.out.trim().split('\n')).toHaveLength(1)
          expect(one.out).not.toContain('\x1b[')
        }),
      ),
    30_000,
  )

  test(
    '--select and --ndjson',
    () =>
      run(
        Effect.gen(function* () {
          const fields = yield* cli(['diagram', '--select', 'count'])
          expect(Object.keys(parseRec(fields.out))).toEqual(['count'])
          const nd = yield* cli(['diagram', '--ndjson'])
          const lines = nd.out.trim().split('\n')
          expect(lines.length).toBeGreaterThan(1)
          for (const line of lines) expect(typeof parseJson(line)).toBe('string')
        }),
      ),
    30_000,
  )
})
