// SimHash contract: published FNV-1a vectors, a single token's fingerprint is
// its own 64-bit hash, pinned fingerprints, and the SimHash property (small
// edits stay within k = 3 bits, unrelated texts sit near 32 bits apart).
import { expect, test } from 'bun:test'
import { fnv1a32, hamming, simhash64, tokenHash } from '../../src/lib/simhash.ts'

test('fnv1a32 matches the published FNV-1a 32-bit vectors', () => {
  expect(fnv1a32('')).toBe(0x811c9dc5)
  expect(fnv1a32('a')).toBe(0xe40c292c)
  expect(fnv1a32('foobar')).toBe(0xbf9cf968)
})

test('one token: every column vote is unanimous, so the fingerprint is the token hash', () => {
  const [lo, hi] = tokenHash('tides')
  expect(simhash64('Tides!')).toBe((BigInt(hi) << 32n) | BigInt(lo))
  expect(simhash64('')).toBe(0n)
})

test('pinned fingerprints (change only with a deliberate hash change)', () => {
  expect(simhash64('tides')).toBe(0x523db0f4c33c629dn)
  expect(simhash64('The Bay of Fundy has the highest tides on Earth')).toBe(0x0cd13b19c11628d8n)
})

const seeded = (seed: number) => () => {
  seed ^= seed << 13
  seed ^= seed >>> 17
  seed ^= seed << 5
  return (seed >>> 0) / 0x1_0000_0000
}

test('property: one edited word in 300 stays near; unrelated texts average ~32 bits apart', () => {
  const rand = seeded(0x2545f491)
  const word = () => `w${Math.floor(rand() * 50_000).toString(36)}`
  const near: number[] = []
  const far: number[] = []
  for (let trial = 0; trial < 200; trial++) {
    const doc = Array.from({ length: 300 }, word)
    const edited = [...doc]
    edited[Math.floor(rand() * doc.length)] = word()
    const sig = simhash64(doc.join(' '))
    near.push(hamming(sig, simhash64(edited.join(' '))))
    far.push(hamming(sig, simhash64(Array.from({ length: 300 }, word).join(' '))))
  }
  const sorted = near.sort((a, b) => a - b)
  expect(sorted[Math.floor(sorted.length * 0.9)]).toBeLessThanOrEqual(3)
  const meanFar = far.reduce((a, b) => a + b, 0) / far.length
  expect(meanFar).toBeGreaterThan(28)
  expect(meanFar).toBeLessThan(36)
  expect(Math.min(...far)).toBeGreaterThan(3)
})
