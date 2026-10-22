// Meta prescan follows the WHATWG rules: comments are skipped, only real
// attributes of <meta> tags count, `charset` is a whole attribute name, and a
// meta tag with an unknown label does not end the scan.
import { describe, expect, test } from 'bun:test'
import { pickCharset } from '../../src/core/decode.ts'

const pick = (html: string, contentType: string | null = 'text/html') =>
  pickCharset(contentType, new TextEncoder().encode(html))

describe('metaCharset — WHATWG prescan', () => {
  test('a meta inside a comment is ignored', () => {
    expect(pick('<!-- <meta charset="shift_jis"> --><meta charset="windows-1252">')).toBe(
      'windows-1252',
    )
    expect(pick('<!-- <meta charset="shift_jis"> -->')).toBe('utf-8')
  })

  test('charset text inside another attribute value is ignored', () => {
    expect(pick('<meta name="description" content="use charset=shift_jis here">')).toBe('utf-8')
    expect(pick('<meta name="x" content="a charset=shift_jis"><meta charset="windows-1252">')).toBe(
      'windows-1252',
    )
  })

  test('xcharset= is not charset=', () => {
    expect(pick('<meta xcharset="shift_jis">')).toBe('utf-8')
    expect(pick('<meta http-equiv="content-type" content="text/html; xcharset=shift_jis">')).toBe(
      'utf-8',
    )
    expect(pick('<p>', 'text/html; xcharset=shift_jis')).toBe('utf-8')
  })

  test('an unknown label keeps scanning later meta tags', () => {
    expect(pick('<meta charset="bogus-label"><meta charset="shift_jis">')).toBe('shift_jis')
    expect(
      pick(
        '<meta charset="bogus"><meta http-equiv="Content-Type" content="text/html; charset=windows-1252">',
      ),
    ).toBe('windows-1252')
  })

  test('real forms still work: unquoted, single-quoted, spaced, self-closed', () => {
    expect(pick('<meta charset=shift_jis>')).toBe('shift_jis')
    expect(pick("<meta charset='shift_jis'/>")).toBe('shift_jis')
    expect(pick('<META  CHARSET = "Shift_JIS" >')).toBe('shift_jis')
  })
})
