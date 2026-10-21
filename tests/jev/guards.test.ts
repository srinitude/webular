// Guards on Jev payloads and replies: every key fact is read by a question,
// every Choice ends with `none`, gating Choices ask both option orders, HTTP
// statuses map to error kinds, retry-after parses, and model drift is flagged.
import { expect, test } from 'bun:test'
import { createMachine } from 'xstate'
import { decisions } from '../../src/lib/jev/decisions.ts'
import { errorKind, nextAction, retryAfterMs } from '../../src/lib/jev/errors.ts'
import { machinePayload } from '../../src/lib/jev/machine.ts'
import {
  agreedPick,
  bothOrders,
  CAPS,
  choice,
  menu,
  NONE_OPTION,
  SWAPPED,
  unreadFacts,
} from '../../src/lib/jev/payload/index.ts'
import { JEV_CALIBRATED_MODEL, modelDrift } from '../../src/lib/jev/store.ts'

// The research payload for a whole state: one batch holding every sub-question.
const researchArg = (s: Parameters<typeof decisions.research>[0]) =>
  decisions.researchPart.def.payload({ s, part: s.subQuestions })

const machine = createMachine({
  id: 'scrape',
  initial: 'idle',
  states: { idle: { on: { FETCH: 'busy', SKIP: 'done' } }, busy: {}, done: {} },
})

test('every key fact in a payload is read by a question', () => {
  const snapshot = machine.resolveState({ value: 'idle', context: undefined as never })
  const payloads = {
    link: decisions.link.def.payload({
      goal: 'goal',
      page: { url: 'https://a.dev', title: 'A' },
      link: { url: 'https://a.dev/x', anchor: 'x' },
    }),
    change: decisions.change.def.payload({
      url: 'https://a.dev',
      watchFor: 'price',
      diff: '-a\n+b',
    }),
    research: researchArg({
      topic: 't',
      round: 1,
      maxRounds: 3,
      subQuestions: [{ question: 'q', bestEvidence: 'e' }],
    }),
    machine: machinePayload({
      machine,
      snapshot,
      observed: { type: 'FETCH' },
      goal: 'g',
      allowed: ['FETCH', 'SKIP'],
    }),
  }
  for (const [name, req] of Object.entries(payloads))
    expect([name, unreadFacts(req)]).toEqual([name, []])
  expect(
    unreadFacts({ state: { page: { url: 'u' } }, questions: { q: { instructions: 'no path' } } }),
  ).toEqual(['page.url'])
})

test('every Choice ends with none, inside the 240-option cap', () => {
  const many = Array.from({ length: 500 }, (_, i) => `o${i}`)
  const m = menu('o7', [...many, NONE_OPTION])
  const keys = Object.keys(m)
  expect(keys[0]).toBe('o7')
  expect(keys.at(-1)).toBe(NONE_OPTION)
  expect(keys.length).toBe(CAPS.options)
  expect(keys.filter((k) => k === NONE_OPTION).length).toBe(1)
})

test('a gating Choice asks both orders and acts only when both agree at the bar', () => {
  const q = bothOrders('pick', choice('Which?', menu('a', ['b', 'c'])))
  expect(Object.keys(q['pick']?.criteria ?? {})).toEqual(['a', 'b', 'c', NONE_OPTION])
  expect(Object.keys(q[`pick${SWAPPED}`]?.criteria ?? {})).toEqual(['c', 'b', 'a', NONE_OPTION])
  const ans = (x: string, cx: number, y: string, cy: number) => ({
    pick: { choice: x, confidence: cx },
    [`pick${SWAPPED}`]: { choice: y, confidence: cy },
  })
  expect(agreedPick(ans('a', 0.97, 'a', 0.96), 'pick', 0.95)).toBe('a')
  expect(agreedPick(ans('a', 0.97, 'c', 0.97), 'pick', 0.95)).toBeUndefined()
  expect(agreedPick(ans('a', 0.97, 'a', 0.9), 'pick', 0.95)).toBeUndefined()
  expect(agreedPick(ans(NONE_OPTION, 0.99, NONE_OPTION, 0.99), 'pick', 0.95)).toBeUndefined()
})

test('research.done asks both orders; done needs both answers to agree at the bar', () => {
  const { def } = decisions.researchPart
  const input = def.sample()
  expect(Object.keys(def.payload(input).questions)).toEqual(['pick', 'pick_reversed'])
  const ans = (x: string, cx: number, y: string, cy: number) => ({
    pick: { type: 'choice', choice: x, confidence: cx },
    pick_reversed: { type: 'choice', choice: y, confidence: cy },
  })
  expect(def.read(ans('done', 0.97, 'done', 0.96), 0.95, input)).toBe(true)
  expect(def.read(ans('keep_searching', 0.97, 'keep_searching', 0.96), 0.95, input)).toBe(false)
  expect(def.read(ans('done', 0.97, 'keep_searching', 0.97), 0.95, input)).toBeUndefined()
  expect(def.read(ans('done', 0.99, 'done', 0.9), 0.95, input)).toBeUndefined()
})

test('HTTP statuses map to error kinds and next actions; 429 reads retry-after', () => {
  const kinds = [400, 401, 403, 404, 422, 429, 500, 529].map(errorKind)
  expect(kinds).toEqual([
    'bad_request',
    'auth',
    'forbidden',
    'not_found',
    'invalid',
    'rate_limited',
    'server',
    'server',
  ])
  for (const k of kinds) expect(nextAction(k).length).toBeGreaterThan(0)
  expect(retryAfterMs({ 'retry-after-ms': '250' }, 0)).toBe(250)
  expect(retryAfterMs({ 'retry-after': '2' }, 0)).toBe(2_000)
  expect(
    retryAfterMs(
      { 'retry-after': 'Wed, 21 Oct 2026 05:00:03 GMT' },
      Date.parse('Wed, 21 Oct 2026 05:00:00 GMT'),
    ),
  ).toBe(3_000)
  expect(retryAfterMs({}, 0)).toBeUndefined()
})

test('an answering model other than the calibrated one is drift', () => {
  expect(modelDrift(JEV_CALIBRATED_MODEL)).toBe(false)
  expect(modelDrift('jev-1.14.0')).toBe(true)
  expect(modelDrift(undefined)).toBe(false)
})
