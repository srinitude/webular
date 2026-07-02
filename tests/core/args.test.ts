// Flag-helper contract: bounds-checked integers (0 legal where min allows),
// defaults, and the emit-option projection. Invalid input paths exit(2) and are
// covered by the spawned command tests, not in-process here.
import { describe, expect, test } from 'bun:test'
import { emitOpts, intFlag, optIntFlag, parseFlags, strFlag } from '../../src/core/args.ts'

describe('parseFlags — common surface', () => {
  test('no longer defines the dead quiet/format flags', () => {
    const { values } = parseFlags([])
    expect(values.quiet).toBeUndefined()
    expect(values.format).toBeUndefined()
  })

  test('still parses json, output and timeout', () => {
    const { values } = parseFlags(['--json', '-o', 'out.md', '--timeout', '5000'])
    expect(values.json).toBe(true)
    expect(values.output).toBe('out.md')
    expect(values.timeout).toBe('5000')
  })
})

describe('intFlag — bounds-checked with default', () => {
  test('returns the default when the flag is absent', () => {
    expect(intFlag('crawl', {}, 'depth', { def: 2, min: 0, max: 10 })).toBe(2)
  })

  test('accepts zero when min allows it', () => {
    expect(intFlag('crawl', { depth: '0' }, 'depth', { def: 2, min: 0, max: 10 })).toBe(0)
  })

  test('accepts both boundary values', () => {
    expect(intFlag('c', { n: '1' }, 'n', { def: 4, min: 1, max: 32 })).toBe(1)
    expect(intFlag('c', { n: '32' }, 'n', { def: 4, min: 1, max: 32 })).toBe(32)
  })
})

describe('optIntFlag — bounds-checked without default', () => {
  test('returns undefined when absent', () => {
    expect(optIntFlag('scrape', {}, 'timeout', { min: 1, max: 600_000 })).toBeUndefined()
  })

  test('parses a valid integer', () => {
    expect(optIntFlag('scrape', { timeout: '5000' }, 'timeout', { min: 1, max: 600_000 })).toBe(
      5000,
    )
  })
})

describe('strFlag / emitOpts', () => {
  test('strFlag returns strings and ignores booleans', () => {
    expect(strFlag({ url: 'https://x' }, 'url')).toBe('https://x')
    expect(strFlag({ url: true }, 'url')).toBeUndefined()
    expect(strFlag({}, 'url')).toBeUndefined()
  })

  test('emitOpts projects json and output', () => {
    expect(emitOpts({ json: true, output: 'f.md' })).toEqual({ json: true, output: 'f.md' })
    expect(emitOpts({})).toEqual({ json: false, output: undefined })
  })
})
