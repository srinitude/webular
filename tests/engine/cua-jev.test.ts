// jevDecisions over a fake Jev transport: an answer counts only when both
// option orders agree at >= 0.95 and the code check passes; everything else
// returns the codeDecisions answer. No network.
import { describe, expect, test } from 'bun:test'
import { Effect, Option } from 'effect'
import { codeDecisions, type Intent } from '../../src/lib/cua-ground.ts'
import { decisionsFromEnv, jevDecisions, type Post } from '../../src/lib/cua-jev.ts'
import type { AxElement } from '../../src/lib/cua-tree.ts'

const el = (id: string, role: string, label: string): AxElement => ({
  id,
  token: undefined,
  role,
  label,
  value: '',
  frame: undefined,
})
const text = el('t', 'AXStaticText', 'Name')
const field = el('f', 'AXTextField', 'Name field')
const candidates = [text, field]
const intent: Intent = { label: 'Name', expect: {} }

const reply =
  (forward: string, reverse = forward, confidence = 0.99, noul = 0.9): Post =>
  () =>
    Effect.succeed({
      answers: {
        forward: { choice: forward, confidence },
        reverse: { choice: reverse, confidence },
        any_match: { noul },
      },
    })

const pick = (post: Post, cs = candidates, i = intent) =>
  Effect.runSync(Effect.map(jevDecisions(post).pickTarget(i, cs), Option.getOrNull))
const feasible = (post: Post, cs: AxElement[], i = intent) =>
  Effect.runSync(jevDecisions(post).feasible('goal', i, cs))

describe('jevDecisions.pickTarget', () => {
  test('takes the agreed confident pick (c1 = the field; code would take the text)', () => {
    expect(pick(reply('c1'))).toBe(field)
  })
  test('falls back to code on disagreement, low confidence, a low noul, none, an unknown id, or an error', () => {
    expect(pick(reply('c1', 'c0'))).toBe(text)
    expect(pick(reply('c1', 'c1', 0.9))).toBe(text)
    expect(pick(reply('c1', 'c1', 0.99, 0.2))).toBe(text)
    expect(pick(reply('none'))).toBe(text)
    expect(pick(reply('c7'))).toBe(text)
    expect(pick(() => Effect.fail('down'))).toBe(text)
    expect(pick(() => Effect.succeed({ nope: 1 }))).toBe(text)
  })
  test('sends no request without candidates', () => {
    expect(pick(() => Effect.die('called'), [])).toBeNull()
  })
})

describe('jevDecisions.feasible', () => {
  test('a confident agreed no stops the run even with candidates', () => {
    expect(feasible(reply('no'), candidates)).toBe(false)
  })
  test('yes needs candidates, a hint, or OCR text; otherwise code decides', () => {
    expect(feasible(reply('yes'), [])).toBe(false)
    expect(feasible(reply('yes'), [], { ...intent, ocrText: 'Name' })).toBe(true)
    expect(feasible(reply('no', 'yes'), candidates)).toBe(true)
  })
})

describe('decisionsFromEnv', () => {
  test('defaults to codeDecisions', () => {
    expect(Effect.runSync(decisionsFromEnv)).toBe(codeDecisions)
  })
})
