// Retry-After is digits, or an HTTP-date that is GMT even when the asctime form
// omits the zone. Each parser must read the same header the same way in every
// time zone and locale: no hex or exponent, no "1,5", no empty value.
import { describe, expect, test } from 'bun:test'
import { retryAfterMs as coreRetryAfter } from '../../src/core/http.ts'
import { retryAfterMs as jevRetryAfter } from '../../src/lib/jev/errors.ts'

const NOW = Date.UTC(2026, 9, 21, 7, 27, 55)
const ASCTIME = 'Wed Oct 21 07:28:00 2026'
const jev = (value: string, extra: Record<string, string> = {}) =>
  jevRetryAfter({ 'retry-after': value, ...extra }, NOW)

describe('Retry-After in every time zone', () => {
  test('an asctime date has no zone and still means GMT', () => {
    expect(coreRetryAfter(ASCTIME, NOW)).toBe(5_000)
    expect(jev(ASCTIME)).toBe(5_000)
    expect(jev('Wed, 21 Oct 2026 07:28:00 GMT')).toBe(5_000)
  })
})

describe('Retry-After strictness', () => {
  test('hex and exponent forms are not delay-seconds', () => {
    expect(coreRetryAfter('0x2', NOW)).toBeUndefined()
    expect(coreRetryAfter('1e3', NOW)).toBeUndefined()
    expect(jev('0x10')).toBeUndefined()
    expect(jev('1e3')).toBeUndefined()
  })
  test('a decimal comma is not a date', () => {
    expect(jev('1,5')).toBeUndefined()
    expect(jev('1 2')).toBeUndefined()
  })
  test('an empty retry-after-ms falls through to retry-after', () => {
    expect(jev('3', { 'retry-after-ms': '' })).toBe(3_000)
    expect(jev('')).toBeUndefined()
  })
  test('plain seconds still work', () => {
    expect(jev('2')).toBe(2_000)
    expect(coreRetryAfter('2', NOW)).toBe(2_000)
  })
})
