// Exit codes: the one source for every command, the CLI router, the help
// text, and the machines' `exit-<code>` tags.
import type { AnyStateMachine, EventFromLogic } from 'xstate'
import { replay } from '../machines/agent.ts'

export const EXIT = {
  ok: 0,
  failure: 1,
  usage: 2,
  partial: 3,
  toolchainMissing: 127,
  interrupted: 130,
} as const

export const exitTag = (code: number): string => `exit-${code}`

// Partial-failure rule for discovery commands: failures ride in the payload
// (exit 0 with a stderr note); exit 1 only when the payload is empty and
// errors exist.
export function payloadExit(empty: boolean, errors: number): number {
  return empty && errors > 0 ? EXIT.failure : EXIT.ok
}

// Runs a machine over the events the code observed, through the agent's
// replay (only allowed events are taken), and returns the exit code its final
// state's `exit-<code>` tag names, so the machine decides the exit.
// A run that ends outside a tagged state is a failure.
export function settledExit<M extends AnyStateMachine>(
  machine: M,
  events: EventFromLogic<M>[],
): number {
  const snapshot = replay(machine, events)
  return Object.values(EXIT).find((code) => snapshot.hasTag(exitTag(code))) ?? EXIT.failure
}
