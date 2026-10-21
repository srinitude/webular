// Flag-helper contract: bounds-checked integers (0 legal where min allows),
// defaults, and the emit-option projection. Invalid input paths exit(2) and are
// covered by the spawned command tests, not in-process here.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { emitOpts, intFlag, optIntFlag, parseFlags, strFlag } from '../../src/core/args.ts'
import { eff } from '../_support/run.ts'

describe('parseFlags — common surface', () => {
  test(
    'no longer defines the dead quiet/format flags',
    eff(
      Effect.gen(function* () {
        const { values } = yield* parseFlags([])
        expect(values['quiet']).toBeUndefined()
        expect(values['format']).toBeUndefined()
      }),
    ),
  )

  test(
    'still parses json, output and timeout',
    eff(
      Effect.gen(function* () {
        const { values } = yield* parseFlags(['--json', '-o', 'out.md', '--timeout', '5000'])
        expect(values['json']).toBe(true)
        expect(values['output']).toBe('out.md')
        expect(values['timeout']).toBe('5000')
      }),
    ),
  )
})

describe('parseFlags — unknown flags', () => {
  test(
    'an unknown flag close to a known one gets a did-you-mean hint',
    eff(
      Effect.gen(function* () {
        const near = yield* Effect.flip(parseFlags(['--jsn'], { url: { type: 'string' } }))
        expect(near.exitCode).toBe(2)
        expect(near.message).toContain("Did you mean '--json'?")
        const far = yield* Effect.flip(parseFlags(['--no-such-flag']))
        expect(far.message).not.toContain('Did you mean')
      }),
    ),
  )
})

describe('intFlag — bounds-checked with default', () => {
  const bounds = { def: 2, min: 0, max: 10 }

  test(
    'returns the default when the flag is absent',
    eff(
      Effect.gen(function* () {
        expect(yield* intFlag('crawl', {}, 'depth', bounds)).toBe(2)
      }),
    ),
  )

  test(
    'accepts zero when min allows it',
    eff(
      Effect.gen(function* () {
        expect(yield* intFlag('crawl', { depth: '0' }, 'depth', bounds)).toBe(0)
      }),
    ),
  )

  test(
    'accepts both boundary values',
    eff(
      Effect.gen(function* () {
        expect(yield* intFlag('c', { n: '1' }, 'n', { def: 4, min: 1, max: 32 })).toBe(1)
        expect(yield* intFlag('c', { n: '32' }, 'n', { def: 4, min: 1, max: 32 })).toBe(32)
      }),
    ),
  )
})

describe('optIntFlag — bounds-checked without default', () => {
  const bounds = { min: 1, max: 600_000 }

  test(
    'returns undefined when absent',
    eff(
      Effect.gen(function* () {
        expect(yield* optIntFlag('scrape', {}, 'timeout', bounds)).toBeUndefined()
      }),
    ),
  )

  test(
    'parses a valid integer',
    eff(
      Effect.gen(function* () {
        expect(yield* optIntFlag('scrape', { timeout: '5000' }, 'timeout', bounds)).toBe(5000)
      }),
    ),
  )
})

describe('strFlag / emitOpts', () => {
  test('strFlag returns strings and ignores booleans', () => {
    expect(strFlag({ url: 'https://x' }, 'url')).toBe('https://x')
    expect(strFlag({ url: true }, 'url')).toBeUndefined()
    expect(strFlag({}, 'url')).toBeUndefined()
  })

  test('emitOpts projects json and output', () => {
    expect(emitOpts({ json: true, output: 'f.md' })).toEqual({
      json: true,
      ndjson: false,
      output: 'f.md',
    })
    expect(emitOpts({})).toEqual({ json: false, ndjson: false, output: undefined })
    expect(emitOpts({ ndjson: true, select: 'url, title,' })).toMatchObject({
      ndjson: true,
      fields: ['url', 'title'],
    })
  })
})
