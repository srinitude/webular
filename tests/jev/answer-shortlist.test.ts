// answer.sentence offers the summarizer's best 18 sentences, keyed by original index.
import { expect, test } from 'bun:test'
import { answerSentence } from '../../src/lib/jev/decisions/answer.ts'

const filler = Array.from({ length: 24 }, (_, i) => `Alpha${i} beta${i} gamma${i}.`)
const answer = 'Bun ships bun sqlite, the Bun sqlite driver for Bun.'
const input = { question: 'what sqlite driver does bun ship', text: [...filler, answer].join(' ') }

test('a relevant sentence past index 18 is offered under its original index', () => {
  const { state } = answerSentence.def.payload(input) as unknown as {
    state: { facts: { text: { sentences: Record<string, string> } } }
  }
  expect(Object.keys(state.facts.text.sentences)).toHaveLength(18)
  expect(state.facts.text.sentences['s24']).toBe(answer)
  expect(answerSentence.def.codeCheck(24, input)).toBe(true)
  expect(answerSentence.def.codeCheck(25, input)).toBe(false)
})
