// src/lib/jev/machine.ts caps the moves it sends Jev. The cap must never drop
// the observed move: the fallback and the menu's default are the observed
// move whenever the machine allows it.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { type AnyMachineSnapshot, createMachine, getInitialSnapshot } from 'xstate'
import { allowedEvents } from '../../src/lib/jev/machine.ts'
import { CAPS } from '../../src/lib/jev/payload/index.ts'
import { eff } from '../_support/run.ts'

const TYPES = Array.from({ length: CAPS.fields + 1 }, (_, n) => `E${String(n).padStart(2, '0')}`)
const wide = createMachine({
  id: 'wide',
  initial: 'idle',
  states: { idle: { on: Object.fromEntries(TYPES.map((t) => [t, 'done'])) }, done: {} },
})
const start = getInitialSnapshot(wide) as AnyMachineSnapshot
const last = TYPES[TYPES.length - 1] ?? ''

test(
  'the cap keeps the observed move when the machine allows it',
  eff(
    Effect.sync(() => {
      const allowed = allowedEvents(start, last)
      expect(allowed).toHaveLength(CAPS.fields)
      expect(allowed).toContain(last)
    }),
  ),
)

test(
  'without an observed move the cap keeps the machine order',
  eff(Effect.sync(() => expect(allowedEvents(start)).toEqual(TYPES.slice(0, CAPS.fields)))),
)
