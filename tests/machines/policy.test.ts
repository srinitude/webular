// Agreement test: the machines and the code read one policy. The machines are
// driven by the shared fetch policy and exit codes; the code is checked against
// the machines by the model-based tests beside this file. This file fails if a
// machine stops matching the policy the code runs.
import { describe, expect, test } from 'bun:test'
import { createActor } from 'xstate'
import { EXIT, exitTag, payloadExit } from '../../src/cli/exit-codes.ts'
import {
  FETCH_ERROR,
  MAX_RETRIES,
  REDIRECT_LIMIT,
  RETRY_ON_TIMEOUT,
} from '../../src/core/fetch-policy.ts'
import { cliDispatchMachine } from '../../src/machines/cli-dispatch.ts'
import { commandLifecycleMachine } from '../../src/machines/command-lifecycle.ts'
import { fetchMachine } from '../../src/machines/fetch.ts'

function fetchAfter(type: string, times: number): string {
  const actor = createActor(fetchMachine).start()
  for (let i = 0; i < times; i++) actor.send({ type } as never)
  return String(actor.getSnapshot().value)
}

describe('fetch machine follows src/core/fetch-policy.ts', () => {
  test.each([
    ['RETRYABLE_STATUS', 'httpFailed', true],
    ['NETWORK_ERROR', 'networkFailed', true],
    ['TIMEOUT', 'timedOut', RETRY_ON_TIMEOUT],
  ] as const)('%s fails after the policy retry budget', (event, failed, retries) => {
    const budget = retries ? MAX_RETRIES : 0
    if (budget > 0) expect(fetchAfter(event, budget)).toBe('requesting')
    expect(fetchAfter(event, budget + 1)).toBe(failed)
  })

  test('the REDIRECT_LIMIT-th same-host redirect fails', () => {
    expect(fetchAfter('REDIRECT_SAME_HOST', REDIRECT_LIMIT - 1)).toBe('requesting')
    expect(fetchAfter('REDIRECT_SAME_HOST', REDIRECT_LIMIT)).toBe('tooManyRedirects')
  })

  test('every fetch error the code raises names a machine final state', () => {
    const finals = Object.keys(fetchMachine.root.states)
    for (const state of Object.keys(FETCH_ERROR)) expect(finals).toContain(state)
  })
})

describe('machine exit tags come from src/cli/exit-codes.ts', () => {
  const allowed = new Set(Object.values(EXIT).map(exitTag))
  test.each([cliDispatchMachine, commandLifecycleMachine])('%#', (machine) => {
    for (const node of Object.values(machine.root.states)) {
      if (node.type !== 'final') continue
      expect(
        node.tags.filter((t: string) => t.startsWith('exit-')).every((t: string) => allowed.has(t)),
      ).toBe(true)
    }
  })

  test('partial-failure rule', () => {
    expect([payloadExit(false, 0), payloadExit(false, 2), payloadExit(true, 0)]).toEqual([0, 0, 0])
    expect(payloadExit(true, 1)).toBe(EXIT.failure)
  })
})
