// Outcome evals for the session view MCP App: its lifecycle machine reaches
// every state with a label and the right next moves, the server serves the
// view as an MCP App resource, and a host with no UI still gets the data.

import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { MCPClient } from '@mastra/mcp'
import { Effect } from 'effect'
import { createActor } from 'xstate'
import { createTestModel } from 'xstate/graph'
import { commandLifecycleMachine } from '../../../src/machines/command-lifecycle.ts'
import { SESSION_VIEW } from '../src/apps.ts'
import { runtime } from '../src/runtime.ts'
import { server } from '../src/server.ts'
import { readResult } from '../src/ui/bridge.ts'
import { moveLabels, nextMoves, resultEvents, stateLabels } from '../src/ui/lifecycle.ts'
import { call, run } from './mcp-harness.ts'

test('the bridge reads a tool result the way the view needs it', () => {
  const text = [{ type: 'text', text: 'webular map failed: bad URL' }]
  expect(readResult({ content: text, isError: true })).toEqual({
    error: true,
    message: 'webular map failed: bad URL',
  })
  const data = { url: 'https://example.com', links: ['https://example.com/a'], errors: [] }
  expect(readResult({ content: text, structuredContent: data })).toEqual(data)
  expect(readResult({ content: text }).error).toBe(true)
})

const serverPath = fileURLToPath(new URL('../src/server.ts', import.meta.url))

test('every path through the lifecycle shows a label and only moves the machine allows', () => {
  const paths = createTestModel(commandLifecycleMachine).getSimplePaths()
  expect(paths.length).toBeGreaterThan(4)
  for (const path of paths) {
    const actor = createActor(commandLifecycleMachine).start()
    for (const step of path.steps) actor.send(step.event)
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toEqual(path.state.value)
    expect(stateLabels[String(snapshot.value)]).toBeString()
    for (const move of nextMoves(snapshot)) {
      expect(snapshot.can({ type: move })).toBe(true)
      expect(moveLabels[move]).toBeString()
    }
    expect(nextMoves(snapshot).length === 0).toBe(snapshot.status === 'done')
  }
})

test('a tool result drives the machine to the same end the CLI exit rule picks', () => {
  const end = (result: Parameters<typeof resultEvents>[0]) => {
    const actor = createActor(commandLifecycleMachine).start()
    for (const event of resultEvents(result)) actor.send(event)
    return actor.getSnapshot().value
  }
  const source = { title: 'A', url: 'https://example.com' }
  const error = { url: 'https://example.org', error: 'timeout' }
  expect(end({ sources: [source], errors: [] })).toBe('completed')
  expect(end({ sources: [source], errors: [error] })).toBe('completedWithPartialFailures')
  expect(end({ sources: [], errors: [error] })).toBe('emptyWithErrors')
  expect(end({ error: true, message: 'webular research failed' })).toBe('failed')
})

const linkOf = (meta: Record<string, unknown> | undefined) =>
  (meta?.ui as { resourceUri?: string } | undefined)?.resourceUri

test('tools/list links research and answer, and only them, to the session view', () =>
  runtime.runPromise(
    Effect.gen(function* () {
      const { tools } = yield* Effect.promise(() => Promise.resolve(server.getToolListInfo()))
      const linked = tools.filter((t) => linkOf(t._meta) === SESSION_VIEW).map((t) => t.name)
      expect(linked.sort()).toEqual(['answer', 'research'])
    }),
  ))

test('a real MCP client reads the session view as one self-contained MCP App page', () =>
  runtime.runPromise(
    Effect.acquireUseRelease(
      Effect.sync(
        () =>
          new MCPClient({
            id: 'webular-session-view-test',
            servers: { webular: { command: 'bun', args: [serverPath] } },
          }),
      ),
      (client) =>
        Effect.gen(function* () {
          const { contents } = yield* Effect.tryPromise(() =>
            client.resources.read('webular', SESSION_VIEW),
          )
          const page = contents[0] as { mimeType?: string; text?: string } | undefined
          expect(page?.mimeType).toBe('text/html;profile=mcp-app')
          expect(String(page?.text)).toContain('<script type="module"')
        }),
      (client) => Effect.promise(() => client.disconnect()),
    ).pipe(Effect.timeout('25 seconds')),
  ))

test('a host that never reads ui:// still gets the linked map result as data', () =>
  run((tools, site) =>
    call(tools, 'map', { url: site.href, limit: 5 }).pipe(
      Effect.map((result) => expect(result).toContain('/second')),
    ),
  ))
