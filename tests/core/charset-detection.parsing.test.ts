// Charset detection edge cases from the WHATWG encoding sniffing rules:
// unknown labels fall through, meta utf-16 means utf-8, the prescan stops at
// 1024 bytes, and multi-byte characters survive chunk splits.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { pickCharset, readTextCapped } from '../../src/core/decode.ts'
import { eff } from '../_support/run.ts'

const ascii = (s: string) => new TextEncoder().encode(s)

const chunked = (parts: Uint8Array[], contentType: string) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const p of parts) c.enqueue(p)
        c.close()
      },
    }),
    { headers: { 'content-type': contentType } },
  )

describe('pickCharset — WHATWG sniffing', () => {
  test('unknown header label falls through to the meta prescan', () => {
    const prefix = ascii('<meta charset="shift_jis">')
    expect(pickCharset('text/html; charset=bogus-label', prefix)).toBe('shift_jis')
  })

  test('meta utf-16 is read as utf-8', () => {
    expect(pickCharset('text/html', ascii('<meta charset="utf-16le">'))).toBe('utf-8')
  })

  test('http-equiv content charset is honored', () => {
    const prefix = ascii(
      '<meta http-equiv="Content-Type" content="text/html; charset=windows-1252">',
    )
    expect(pickCharset('text/html', prefix)).toBe('windows-1252')
  })

  test('meta past the first 1024 bytes is ignored', () => {
    const prefix = ascii(`${' '.repeat(1100)}<meta charset="shift_jis">`)
    expect(pickCharset('text/html', prefix)).toBe('utf-8')
  })

  test('utf-16be BOM beats the header and meta', () => {
    const bom = new Uint8Array([0xfe, 0xff, 0x00, 0x68])
    expect(pickCharset('text/html; charset=shift_jis', bom)).toBe('utf-16be')
  })
})

describe('readTextCapped — multi-byte split across chunks', () => {
  test(
    'Shift_JIS character split at a chunk boundary after the prescan',
    eff(
      Effect.gen(function* () {
        // 0x82 0xa0 is "あ" in Shift_JIS; split it across two chunks.
        const head = ascii(`<meta charset="shift_jis">${' '.repeat(1100)}`)
        const res = chunked([head, new Uint8Array([0x82]), new Uint8Array([0xa0])], 'text/html')
        expect((yield* readTextCapped(res, 'u', 1 << 20)).endsWith('あ')).toBe(true)
      }),
    ),
  )

  test(
    'utf-8 character split inside the prescan window',
    eff(
      Effect.gen(function* () {
        const bytes = ascii('café')
        const res = chunked([bytes.slice(0, 4), bytes.slice(4)], 'text/plain')
        expect(yield* readTextCapped(res, 'u', 1024)).toBe('café')
      }),
    ),
  )

  test(
    'unknown header label decodes with the meta charset',
    eff(
      Effect.gen(function* () {
        const res = chunked(
          [ascii('<meta charset="windows-1252">caf'), new Uint8Array([0xe9])],
          'text/html; charset=nope',
        )
        expect((yield* readTextCapped(res, 'u', 1024)).endsWith('café')).toBe(true)
      }),
    ),
  )
})
