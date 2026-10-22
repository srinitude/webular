// The summarize pool reaches past the first 20 sentences, keeps s0 and the rule's
// picks, fits the token cap, and a Jev outage returns the frequency picks.
import { expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { JEV_MODEL_DEFAULT, Jev } from '../../src/lib/jev/client.ts'
import { summaryDecision, topIndexes } from '../../src/lib/jev/decisions/summarize.ts'
import { candidatePool, poolSize } from '../../src/lib/jev/decisions/summarize-pool.ts'
import {
  JEV_TOKEN_CAP,
  payloadTokens,
  requestBytes,
  unreadFacts,
} from '../../src/lib/jev/payload/index.ts'
import cases from './evals/summarize.lead.json'

const all = [...cases['baseline-wins'], ...cases['baseline-loses']]
const byName = (name: string) => all.find((c) => c.case === name)?.input ?? { text: '', topN: 1 }

test('a lead at s35 of a 60-sentence page is a lead option, with s0 and the rule picks', () => {
  const input = byName('lead at s35 of 60')
  const pool = candidatePool(input.text, input.topN)
  expect(pool).toContain(35)
  expect(pool).toContain(0)
  for (const i of topIndexes(input.text, input.topN)) expect(pool).toContain(i)
  expect(pool).toEqual([...pool].sort((a, b) => a - b))
  const q = summaryDecision.def.payload(input).questions
  expect(Object.keys((q['lead'] as { criteria?: object } | undefined)?.criteria ?? {})).toContain(
    's35',
  )
  expect(Object.keys(q)).toEqual(['lead', 'lead_swapped', 'lead_exists'])
})

test('the pool holds max(40, 4 x asked) ranked sentences', () => {
  expect(poolSize(1)).toBe(40)
  expect(poolSize(25)).toBe(100)
  const input = byName('long page 300')
  expect(candidatePool(input.text, 1).length).toBeLessThanOrEqual(41)
})

test('41 sentences of 600 characters fit the token cap and read every fact', () => {
  const input = byName('token cap: 41 sentences of 600 chars')
  const r = summaryDecision.def.payload(input)
  expect(payloadTokens(requestBytes(JEV_MODEL_DEFAULT, r.state, r.questions))).toBeLessThanOrEqual(
    JEV_TOKEN_CAP,
  )
  expect(unreadFacts(r)).toEqual([])
})

test('with Jev down the summary is the frequency picks', () => {
  const off = Layer.succeed(Jev, Jev.of({ available: false, ask: () => Effect.die('unused') }))
  const input = byName('lead at s35 of 60')
  const got = Effect.runSync(summaryDecision(input).pipe(Effect.provide(off)))
  expect(got).toEqual({ picks: topIndexes(input.text, input.topN) })
})
