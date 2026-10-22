// Unicode and Markdown edge cases: NFC/NFD and zero-width characters must not
// change a SimHash, short errors never split a surrogate pair, and a page title
// becomes one safe Markdown heading line.
import { expect, test } from 'bun:test'
import { ERROR_MAX_CHARS, mdHeading, shortError } from '../../src/core/output.ts'
import { simhash64 } from '../../src/lib/simhash.ts'

test('NFD and NFC spellings of the same text share a SimHash', () => {
  const nfc = 'café naïve résumé façade'.normalize('NFC')
  expect(simhash64(nfc.normalize('NFD'))).toBe(simhash64(nfc))
})

test('zero-width characters inside a word do not change the SimHash', () => {
  expect(simhash64('hel​lo wor‍ld ﻿again')).toBe(simhash64('hello world again'))
})

test('shortError never ends on a lone high surrogate', () => {
  const msg = `${'a'.repeat(ERROR_MAX_CHARS - 2)}😀tail`
  const out = shortError(new Error(msg))
  expect(out.isWellFormed()).toBe(true)
})

test('mdHeading keeps a title on one line and escapes Markdown syntax', () => {
  expect(mdHeading('Line one\n# not a heading​')).toBe('Line one \\# not a heading')
  expect(mdHeading('a [link](x) *b* _c_ `d` | e')).toBe(
    'a \\[link\\]\\(x\\) \\*b\\* \\_c\\_ \\`d\\` \\| e',
  )
})
