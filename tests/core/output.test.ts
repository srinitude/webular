// Token and determinism rules shared by the CLI and the MCP server: sorted-key
// JSON, field selection, NDJSON, lossless cursor paging, short errors.
import { describe, expect, test } from 'bun:test'
import {
  ERROR_MAX_CHARS,
  estimateTokens,
  formatOutput,
  PAGE_MAX_CHARS,
  pageText,
  selectFields,
  shortError,
  stableJson,
  toNdjson,
  unknownFieldsNote,
} from '../../src/core/output.ts'

describe('stableJson', () => {
  test('same value built in any key order gives the same bytes', () => {
    const a = { z: 1, a: { y: [{ b: 2, a: 1 }], x: null } }
    const b = { a: { x: null, y: [{ a: 1, b: 2 }] }, z: 1 }
    expect(stableJson(a)).toBe(stableJson(b))
    expect(stableJson(a)).toBe('{"a":{"x":null,"y":[{"a":1,"b":2}]},"z":1}')
  })

  test('keeps array order (order is data)', () => {
    expect(stableJson([3, 1, 2])).toBe('[3,1,2]')
  })
})

describe('selectFields / toNdjson', () => {
  test('keeps only named top-level fields, skips unknown ones', () => {
    expect(selectFields({ a: 1, b: 2, c: 3 }, ['c', 'a', 'nope'])).toEqual({ c: 3, a: 1 })
    expect(selectFields({ a: 1 }, undefined)).toEqual({ a: 1 })
  })

  test('a --select name the output lacks gets a stderr note listing the fields', () => {
    expect(unknownFieldsNote({ b: 1, a: 2 }, ['a', 'nope'])).toBe(
      'select: no field "nope" in this output; fields: a, b',
    )
    expect(unknownFieldsNote({ a: 1 }, ['a'])).toBeUndefined()
    expect(unknownFieldsNote([1], ['a'])).toBeUndefined()
  })

  test('one sorted-key line per item of the first array field', () => {
    expect(
      toNdjson({
        count: 2,
        results: [
          { u: 1, t: 'x' },
          { u: 2, t: 'y' },
        ],
      }),
    ).toBe('{"t":"x","u":1}\n{"t":"y","u":2}')
    expect(toNdjson({ only: 'object' })).toBe('{"only":"object"}')
  })
})

describe('formatOutput', () => {
  const data = { title: 'T', count: 1, results: [{ url: 'u' }] }

  test('--json off a TTY is one sorted line', () => {
    expect(formatOutput(data, { json: true, output: 'f.json' })).toBe(
      '{"count":1,"results":[{"url":"u"}],"title":"T"}',
    )
  })

  test('--fields implies JSON and narrows it', () => {
    expect(formatOutput(data, { fields: ['title'], output: 'f.json' })).toBe('{"title":"T"}')
  })

  test('identical input gives identical output (no clock, no randomness)', () => {
    const runs = new Set(
      Array.from({ length: 5 }, () => formatOutput(data, { json: true, output: 'f' })),
    )
    expect(runs.size).toBe(1)
  })

  test('human output never carries ANSI color', () => {
    expect(formatOutput(data, {})).not.toContain('\x1b[')
  })
})

describe('pageText — lossless cursor paging', () => {
  test('pages joined in order equal the input, cursors are stable', () => {
    const text = `${'a😀'.repeat(15_000)}end`
    const pages: string[] = []
    let cursor: string | undefined
    do {
      const page = pageText(text, cursor)
      expect(page.ok).toBe(true)
      const chunk = page.ok ? page.text : ''
      expect(chunk.length).toBeLessThanOrEqual(PAGE_MAX_CHARS)
      pages.push(chunk)
      cursor = page.ok ? page.nextCursor : undefined
    } while (cursor)
    expect(pages.join('')).toBe(text)
    expect(pages.length).toBe(3)
    expect(pageText(text)).toEqual(pageText(text))
  })

  test('short text is one page with no cursor', () => {
    expect(pageText('hi')).toEqual({ ok: true, text: 'hi', totalChars: 2 })
  })

  test('bad cursor is a short actionable error', () => {
    for (const bad of ['-1', 'x', '1.5', '99']) {
      expect(pageText('short', bad).ok).toBe(false)
    }
  })
})

describe('budgets', () => {
  test('a full page stays within 5,000 tokens', () => {
    expect(estimateTokens('x'.repeat(PAGE_MAX_CHARS))).toBeLessThanOrEqual(5_000)
  })

  test('errors are one line under the cap', () => {
    const msg = shortError(new Error(`${'boom '.repeat(200)}\nstack line`))
    expect(msg).not.toContain('\n')
    expect(msg.length).toBeLessThanOrEqual(ERROR_MAX_CHARS)
  })
})
