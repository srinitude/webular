// In-memory near-duplicate tables: 64-bit SimHash fingerprints with Manku pigeonhole lookup.
import { popcount32 } from './simhash.ts'

/** In-memory near-duplicate tables; the crawler keeps one per run without an FTS database. */
export interface Fingerprints {
  /** Fingerprints as interleaved [lo32, hi32] pairs: 8 bytes per page, no BigInt in the scan. */
  readonly signatures: number[]
  /** Manku pigeonhole tables: 4 maps from a 16-bit block value to fingerprint ids. */
  readonly blocks: ReadonlyArray<Map<number, number[]>>
}

export const emptyFingerprints = (): Fingerprints => ({
  signatures: [],
  blocks: [0, 1, 2, 3].map(() => new Map()),
})

// Manku, Jain, Das Sarma (WWW 2007): k <= 3 on 64-bit fingerprints.
const NEAR_DUPLICATE_BITS = 3

// Pigeonhole (Manku et al.): split 64 bits into 4 blocks of 16; two
// fingerprints within 3 bits agree exactly on at least one block. Lookup
// checks only ids sharing a block: expected O(1 + n/2^16) per insert instead
// of an O(n) scan; space O(n).
const blockKeys = (lo: number, hi: number) => [lo & 0xffff, lo >>> 16, hi & 0xffff, hi >>> 16]

export function remember(index: Fingerprints, lo: number, hi: number) {
  const id = index.signatures.length / 2
  index.signatures.push(lo, hi)
  blockKeys(lo, hi).forEach((key, t) => {
    const table = index.blocks[t] as Map<number, number[]>
    const ids = table.get(key)
    if (ids) ids.push(id)
    else table.set(key, [id])
  })
}

export const isNearDuplicate = (index: Fingerprints, lo: number, hi: number) => {
  const sigs = index.signatures
  return blockKeys(lo, hi).some((key, t) =>
    (index.blocks[t]?.get(key) ?? []).some(
      (id) =>
        popcount32(lo ^ (sigs[2 * id] as number)) + popcount32(hi ^ (sigs[2 * id + 1] as number)) <=
        NEAR_DUPLICATE_BITS,
    ),
  )
}
