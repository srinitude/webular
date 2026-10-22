// 64-bit Charikar SimHash for near-duplicate detection (Manku, Jain, Das
// Sarma, WWW 2007: k <= 3 differing bits on 64-bit fingerprints).

import { ZERO_WIDTH } from '../core/output.ts'

// NFC and no zero-width marks first, so NFD text and "hel\u200Blo" hash as typed;
// \p{M} keeps combining marks inside their word.
export const words = (text: string) =>
  text
    .normalize('NFC')
    .replace(ZERO_WIDTH, '')
    .toLowerCase()
    .match(/[\p{L}\p{M}\p{N}]+/gu) ?? []

const FNV_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193
const GOLDEN = 0x9e3779b9

/** FNV-1a 32-bit over UTF-16 code units (equals the published byte vectors for ASCII). */
export const fnv1a32 = (s: string): number => {
  let h = FNV_BASIS
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), FNV_PRIME)
  return h >>> 0
}

// MurmurHash3 finalizer: full avalanche, so multiply-xor low bits stop being linear.
const fmix32 = (v: number) => {
  let h = v ^ (v >>> 16)
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * The 64-bit token hash as [lo32, hi32]: lo = fmix32(FNV-1a), hi = fmix32(lo +
 * golden ratio). A second multiply-xor pass over the chars (Murmur multiplier)
 * gave 4x more document pairs within 8 bits on a Zipf corpus; this chain
 * matches wyhash's spread.
 */
export const tokenHash = (word: string): readonly [number, number] => {
  const lo = fmix32(fnv1a32(word))
  return [lo, fmix32((lo + GOLDEN) | 0)]
}

// Bit-sliced column counters: planes[p] holds bit p of all 32 column counts,
// so adding one hash is a ripple carry of amortized 2 word ops, not 32 adds.
const addColumns = (planes: Int32Array, x: number) => {
  let carry = x
  for (let p = 0; carry !== 0; p++) {
    const next = (planes[p] as number) & carry
    planes[p] = (planes[p] as number) ^ carry
    carry = next
  }
}

// Bit set when more than half the tokens set it: Charikar's sum(±1) > 0.
const majority = (planes: Int32Array, n: number) => {
  const depth = 32 - Math.clz32(n)
  let out = 0
  for (let bit = 0; bit < 32; bit++) {
    let ones = 0
    for (let p = 0; p < depth; p++) ones += (((planes[p] as number) >>> bit) & 1) * 2 ** p
    if (2 * ones > n) out |= 1 << bit
  }
  return out >>> 0
}

/**
 * Charikar SimHash over word tokens with int32 math only in the hot loop.
 * Time O(chars) with amortized O(1) counter work per token, which meets the
 * read-every-token lower bound; space O(1). One BigInt is built per document.
 */
export const simhash64 = (text: string): bigint => {
  const loPlanes = new Int32Array(32)
  const hiPlanes = new Int32Array(32)
  const tokens = words(text)
  for (const word of tokens) {
    const [lo, hi] = tokenHash(word)
    addColumns(loPlanes, lo)
    addColumns(hiPlanes, hi)
  }
  const lo = majority(loPlanes, tokens.length)
  const hi = majority(hiPlanes, tokens.length)
  return (BigInt(hi) << 32n) | BigInt(lo)
}

export const popcount32 = (v: number) => {
  let x = v - ((v >>> 1) & 0x55555555)
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

export const halves = (sig: bigint) => [Number(sig & 0xffffffffn), Number(sig >> 32n)] as const

export const hamming = (a: bigint, b: bigint): number => {
  const [al, ah] = halves(a)
  const [bl, bh] = halves(b)
  return popcount32(al ^ bl) + popcount32(ah ^ bh)
}
