// SUMMARIZE contract — deterministic local text, no network calls.
import { describe, expect, test } from 'bun:test'

import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'

const runSummarize = (args: string[]) => runCli('src/commands/summarize.ts', args)

const SAMPLE = [
  'The quick brown fox jumps over the lazy dog near the riverbank.',
  'Scientists discovered a new species of deep-sea fish in the Pacific Ocean last year.',
  'Machine learning models require large datasets to achieve high accuracy.',
  'The ancient city of Rome was founded on the banks of the Tiber River.',
  'Renewable energy sources like solar and wind power are growing rapidly worldwide.',
].join(' ')

describe('webular summarize — extractive summary (no network)', () => {
  test('returns one sentence JSON with --sentences 1 --json', async () => {
    const { code, out } = await runSummarize(['--text', SAMPLE, '--sentences', '1', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(Array.isArray(data.sentences)).toBe(true)
    expect(data.sentences.length).toBe(1)
    expect(typeof data.summary).toBe('string')
    expect(data.summary.length).toBeGreaterThan(0)
  })

  test('picked sentence is a substring of original text', async () => {
    const { code, out } = await runSummarize(['--text', SAMPLE, '--sentences', '1', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(SAMPLE).toContain(data.sentences[0])
  })

  test('returns multiple sentences with --sentences 3', async () => {
    const { code, out } = await runSummarize(['--text', SAMPLE, '--sentences', '3', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.sentences.length).toBe(3)
    expect(data.summary).toBe(data.sentences.join(' '))
  })

  test('exits code 2 when no input given', async () => {
    const { code, err } = await runSummarize([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('exits with code 2 for a non-integer --sentences', async () => {
    const { code, err } = await runSummarize(['--text', 'One. Two.', '--sentences', 'abc'])
    expect(code).toBe(2)
    expect(err).toContain('--sentences')
  })
})
