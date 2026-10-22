// One neutral judge wording: no question instruction, option description, or level text
// pleads or pushes (arXiv 2609.09703). Reading this wording never changes a decision.
import { expect, test } from 'bun:test'
import type { JevRequest } from '../../src/lib/jev/client.ts'
import { decideCropBox } from '../../src/lib/jev/decisions/crop-box.ts'
import { imageKindDecision } from '../../src/lib/jev/decisions/image-kind.ts'
import { routeDecision } from '../../src/lib/jev/decisions/image-router.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import { fetchBlockDecision, fetchErrorDecision } from '../../src/lib/jev/fetch.ts'
import { fetchBrowserDecision } from '../../src/lib/jev/fetch-browser.ts'
import { nextEvent } from '../../src/lib/jev/machine.ts'

interface Listed {
  readonly def: {
    readonly name: string
    readonly payload: (i: never) => JevRequest
    readonly sample: () => unknown
  }
}
// Wrappers such as mapOrder carry a partial `def` with no payload; they define nothing.
const listed = (d: object): ReadonlyArray<Listed> =>
  'payload' in (Reflect.get(d, 'def') ?? {}) ? [d as Listed] : []
const ALL: ReadonlyArray<Listed> = [
  ...Object.values(decisions).flatMap(listed),
  ...[
    fetchErrorDecision,
    fetchBlockDecision,
    fetchBrowserDecision,
    nextEvent,
    routeDecision,
    decideCropBox,
    imageKindDecision,
  ].flatMap(listed),
]

// A pleading or pushy word. Instructions also reject "!"; option text can carry input
// text (summarize.lead lists page sentences), so it is held to the words only.
const PUSHY = /\b(please|important|critical|crucial)\b/i
const PUSHY_INSTRUCTION = /\b(please|important|critical|crucial)\b|!/i

const strings = (v: unknown): ReadonlyArray<string> =>
  typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []

// Every instruction, option description, and level text of one built request that trips its rule.
const pushy = (req: JevRequest): ReadonlyArray<string> =>
  Object.values(req.questions ?? {}).flatMap((q) => [
    ...strings(Reflect.get(q as object, 'instructions')).filter((s) => PUSHY_INSTRUCTION.test(s)),
    ...strings(Reflect.get(q as object, 'criteria')).filter((s) => PUSHY.test(s)),
  ])

test('neutral wording: no decision pleads or pushes in its instructions, options, or levels', () => {
  expect(ALL.length).toBeGreaterThan(0)
  for (const { def } of ALL) {
    const built = (def.payload as (i: unknown) => JevRequest)(def.sample())
    expect([def.name, pushy(built)]).toEqual([def.name, []])
  }
})

test('neutral wording: the pattern flags each pleading and pushy form', () => {
  for (const bad of ['Please pick', 'This is IMPORTANT', 'a critical page', 'Crucial'])
    expect(PUSHY.test(bad)).toBe(true)
  expect(PUSHY_INSTRUCTION.test('Go!')).toBe(true)
  for (const ok of ['Pick the page kind.', 'importantly distinct', 'pleasing'])
    expect(PUSHY_INSTRUCTION.test(ok)).toBe(false)
})
