// Outcome evals for the map explorer and monitor diff views: a URL list folds
// into a site tree with counts and failures, a unified diff splits into side by
// side rows, each tool links to the view the design gives it, and the server
// serves every view as an MCP App page.

import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { MCPClient } from '@mastra/mcp'
import { Effect } from 'effect'
import { createActor } from 'xstate'
import { commandLifecycleMachine } from '../../../src/machines/command-lifecycle.ts'
import { MAP_VIEW, MONITOR_VIEW, SESSION_VIEW } from '../src/apps.ts'
import { runtime } from '../src/runtime.ts'
import { server } from '../src/server.ts'
import { asText, resultEvents } from '../src/ui/lifecycle.ts'
import { when } from '../src/ui/parts.tsx'
import { buildTree, citations, splitDiff } from '../src/ui/views.ts'

test('a URL list folds into a site tree with a count on each folder and failures kept', () => {
  const tree = buildTree(
    ['https://a.test/', 'https://a.test/docs/one', 'https://a.test/docs/two'],
    [{ url: 'https://a.test/docs/three', reason: 'The operation timed out.' }],
  )
  const host = tree.children.get('a.test')
  expect(tree.count).toBe(4)
  expect(host?.count).toBe(4)
  expect(host?.failed).toBe(1)
  const docs = host?.children.get('docs')
  expect(docs?.count).toBe(3)
  expect(docs?.children.get('three')?.outcome).toBe('Timed out')
  expect(docs?.children.get('one')?.url).toBe('https://a.test/docs/one')
})

test('a unified diff splits into side by side rows that pair removed and added lines', () => {
  const rows = splitDiff('--- a\n+++ b\n@@ -1,3 +1,3 @@\n same\n-old line\n+new line\n+extra\n')
  expect(rows).toEqual([
    { left: 'same', right: 'same' },
    { left: 'old line', right: 'new line' },
    { left: undefined, right: 'extra' },
  ])
})

test('citation markers point at 1-based sources and say when the source failed', () => {
  const parts = citations(
    'Cats sleep [1] and purr [2].',
    [
      { title: 'A', url: 'https://a.test' },
      { title: 'B', url: 'https://b.test' },
    ],
    [{ url: 'https://b.test', reason: 'HTTP 500' }],
  )
  expect(parts).toEqual([
    'Cats sleep ',
    { n: 1, failed: false, missing: false },
    ' and purr ',
    { n: 2, failed: true, missing: false },
    '.',
  ])
})

test('crawl pages and a monitor check drive the machine to its end, and the text copy names it', () => {
  const end = (result: Parameters<typeof resultEvents>[0]) => {
    const actor = createActor(commandLifecycleMachine).start()
    for (const event of resultEvents(result)) actor.send(event)
    return actor.getSnapshot()
  }
  const crawl = {
    root: 'https://a.test',
    pages: [{ url: 'https://a.test/', title: 'A' }],
    errors: [],
  }
  expect(end(crawl).value).toBe('completed')
  expect(end({ url: 'https://a.test', changeStatus: 'same' }).value).toBe('completed')
  const text = asText(end(crawl), crawl)
  expect(text.split('\n')[0]).toBe('Done (1 of 1 read, 0 failed)')
  expect(text).toContain('"root": "https://a.test"')
})

const linkOf = (meta: Record<string, unknown> | undefined) =>
  (meta?.ui as { resourceUri?: string } | undefined)?.resourceUri

test('each tool links to the view the design gives it, and every other tool stays text', () =>
  runtime.runPromise(
    Effect.gen(function* () {
      const { tools } = yield* Effect.promise(() => Promise.resolve(server.getToolListInfo()))
      const links = Object.fromEntries(
        tools.filter((t) => linkOf(t._meta)).map((t) => [t.name, linkOf(t._meta)]),
      )
      expect(links).toEqual({
        research: SESSION_VIEW,
        answer: SESSION_VIEW,
        map: MAP_VIEW,
        crawl: MAP_VIEW,
        monitor: MONITOR_VIEW,
      })
    }),
  ))

const serverPath = fileURLToPath(new URL('../src/server.ts', import.meta.url))

test('a real MCP client reads every view as one self-contained MCP App page', () =>
  runtime.runPromise(
    Effect.acquireUseRelease(
      Effect.sync(
        () =>
          new MCPClient({
            id: 'webular-views-test',
            servers: { webular: { command: 'bun', args: [serverPath] } },
          }),
      ),
      (client) =>
        Effect.forEach(
          [SESSION_VIEW, MAP_VIEW, MONITOR_VIEW],
          (uri) =>
            Effect.tryPromise(() => client.resources.read('webular', uri)).pipe(
              Effect.map(({ contents }) => contents[0] as { mimeType?: string; text?: string }),
              Effect.tap((page) =>
                Effect.sync(() => {
                  expect(page?.mimeType).toBe('text/html;profile=mcp-app')
                  expect(String(page?.text)).toContain('<script type="module"')
                }),
              ),
            ),
          { concurrency: 3 },
        ),
      (client) => Effect.promise(() => client.disconnect()),
    ).pipe(Effect.timeout('25 seconds')),
  ))

test('the view says when a result came back and how long the run took', () => {
  const at = new Date(2026, 9, 21, 13, 5).getTime()
  expect(when({ at, took: 3240 })).toMatch(/^Checked 1:05.PM, took 3\.2 s$/)
  expect(when({ at })).toMatch(/^Checked 1:05.PM$/)
})
