// Decode-layer contract: charset precedence (BOM > header > meta > utf-8),
// streaming byte cap, and content-length prechecks — on real Response objects.
import { describe, expect, test } from 'bun:test'
import { pickCharset, readTextCapped } from '../../src/core/decode.ts'

const latin1 = (s: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array([...s].map((c) => c.charCodeAt(0) & 0xff))

describe('pickCharset — precedence', () => {
  test('BOM wins over the header', () => {
    const bom = new Uint8Array([0xff, 0xfe, 0x68, 0x00])
    expect(pickCharset('text/html; charset=windows-1252', bom)).toBe('utf-16le')
  })

  test('header charset when no BOM', () => {
    expect(pickCharset('text/html; charset=windows-1252', latin1('<html>'))).toBe('windows-1252')
  })

  test('meta prescan when header is silent', () => {
    const prefix = latin1('<html><head><meta charset="windows-1252"></head>')
    expect(pickCharset('text/html', prefix)).toBe('windows-1252')
  })

  test('utf-8 fallback', () => {
    expect(pickCharset('text/html', latin1('<html>'))).toBe('utf-8')
  })
})

describe('readTextCapped — streaming cap + charset decode', () => {
  test('decodes windows-1252 bytes correctly', async () => {
    const res = new Response(latin1('caf\xe9'), {
      headers: { 'content-type': 'text/plain; charset=windows-1252' },
    })
    expect(await readTextCapped(res, 'u', 1024)).toBe('café')
  })

  test('rejects when the stream exceeds the cap', async () => {
    const res = new Response('x'.repeat(100))
    expect(readTextCapped(res, 'u', 10)).rejects.toThrow(/exceeded/)
  })

  test('rejects on an oversized declared content-length', async () => {
    const res = new Response('tiny', { headers: { 'content-length': '5000' } })
    expect(readTextCapped(res, 'u', 100)).rejects.toThrow(/too large/)
  })

  test('a malformed content-length falls through to the stream cap', async () => {
    const res = new Response('x'.repeat(100), { headers: { 'content-length': 'abc' } })
    expect(readTextCapped(res, 'u', 10)).rejects.toThrow(/exceeded/)
    const ok = new Response('fine', { headers: { 'content-length': 'abc' } })
    expect(await readTextCapped(ok, 'u', 1024)).toBe('fine')
  })

  test('an unsupported charset label falls back to utf-8 deterministically', async () => {
    const res = new Response('plain', {
      headers: { 'content-type': 'text/plain; charset=koi8-r' },
    })
    expect(await readTextCapped(res, 'u', 1024)).toBe('plain')
  })
})
