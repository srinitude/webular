// Summarizer robustness (B13): huge vocabularies must not blow the stack
// (Math.max(...spread) dies around tens of thousands of args), and tie
// ordering must stay deterministic.
import { describe, expect, test } from 'bun:test'
import { summarizeText } from '../../src/lib/summarize.ts'

describe('summarizeText — large inputs and stable ties', () => {
  test('handles ~200k unique tokens without a RangeError', () => {
    const words = Array.from({ length: 200_000 }, (_, i) => `tok${i}`).join(' ')
    const result = summarizeText(`${words}.`, 3)
    expect(result.sentences.length).toBeGreaterThan(0)
  }, 30_000)

  test('equal-score sentences keep original order', () => {
    const text = 'Alpha beta gamma. Alpha beta gamma. Alpha beta gamma.'
    const { sentences } = summarizeText(text, 2)
    expect(sentences).toEqual(['Alpha beta gamma.', 'Alpha beta gamma.'])
  })
})
