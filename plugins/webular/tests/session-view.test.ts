// Outcome evals for the session view MCP App: its lifecycle machine reaches
// every state with a label and the right next moves, a tool result reaches
// every end state, and a host with no UI still gets the data.

import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { createActor } from 'xstate'
import { createTestModel } from 'xstate/graph'
import { commandLifecycleMachine } from '../../../src/machines/command-lifecycle.ts'
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
  expect(end({ error: true, message: 'Fix the input: url must be a URL' })).toBe('rejected')
})

test('a host that never reads ui:// still gets the linked map result as data', () =>
  run((tools, site) =>
    call(tools, 'map', { url: site.href, limit: 5 }).pipe(
      Effect.map((result) => expect(result).toContain('/second')),
    ),
  ))
