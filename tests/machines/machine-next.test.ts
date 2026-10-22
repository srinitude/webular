// The `machine.next` tool replays events on every machine in its enum, so an
// agent can walk any flow. Each name must load, start in its first state, and
// offer exactly the events that state accepts.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { machineSchema, machineState } from '../../src/tools/web-machine.ts'
import { eff } from '../_support/run.ts'

const START: Record<string, { state: string; next: string[] }> = {
  cliDispatch: {
    state: 'parsingArgv',
    next: ['HELP', 'KNOWN_COMMAND', 'UNKNOWN_COMMAND', 'VERSION'],
  },
  commandLifecycle: { state: 'validatingInput', next: ['INPUT_INVALID', 'INPUT_VALID'] },
  fetch: {
    state: 'requesting',
    next: [
      'HTTP_ERROR',
      'NETWORK_ERROR',
      'OK',
      'REDIRECT_OFF_HOST',
      'REDIRECT_SAME_HOST',
      'RETRYABLE_STATUS',
      'TIMEOUT',
    ],
  },
  jevCommand: {
    state: 'parsingArgv',
    next: ['CORRECT', 'HELP', 'LEARN', 'USAGE_ERROR'],
  },
  mcpServe: { state: 'serving', next: ['STOP', 'TOOL_INVALID_ARGS', 'TOOL_OK', 'TOOL_UNKNOWN'] },
  scrapeFallback: {
    state: 'fetching',
    next: ['ARCHIVED', 'FETCHED', 'FETCH_FAILED', 'PDF_REFUSED', 'ROBOTS_BLOCKED'],
  },
}

describe('machine.next covers every machine in its enum', () => {
  test('every enum name has an expected start', () => {
    expect([...machineSchema.shape.machine.options].sort() as string[]).toEqual(
      Object.keys(START).sort(),
    )
  })

  test(
    'scrapeFallback replays the render path to a final state',
    eff(
      Effect.gen(function* () {
        const out = yield* machineState('scrapeFallback', [
          'FETCHED',
          'SHELL_RENDER_ON',
          'RENDER_OK',
        ])
        expect(out).toEqual({ state: 'rendered', next: [], done: true, tags: [] })
      }),
    ),
  )

  for (const name of Object.keys(START)) {
    test(
      `${name} starts in its first state`,
      eff(
        Effect.gen(function* () {
          const out = yield* machineState(name as 'fetch', [])
          expect(out.state).toBe(START[name]?.state as string)
          expect([...out.next].sort()).toEqual(START[name]?.next as string[])
        }),
      ),
    )
  }
})
