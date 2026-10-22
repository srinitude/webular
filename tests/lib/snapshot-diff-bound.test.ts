// A huge, very different snapshot pair must not run the diff unbounded or
// write "undefined": past the edit limit the diff is a short note (jsdiff #720).
import { describe, expect, test } from 'bun:test'
import { boundedPatch } from '../../src/lib/snapshot.ts'

const lines = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix} ${i}`).join('\n')

describe('snapshot boundedPatch', () => {
  test('a small change still yields a unified diff', () => {
    const patch = boundedPatch('u', 'a\nb\n', 'a\nc\n', 10)
    expect(patch).toContain('-b')
    expect(patch).toContain('+c')
  })

  test('two large different texts over a small limit give a note, not undefined', () => {
    const patch = boundedPatch('u', lines('old', 500), lines('new', 500), 5)
    expect(patch).toBe('diff too large to show (u)')
  })
})
