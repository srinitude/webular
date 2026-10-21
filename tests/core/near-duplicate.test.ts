// Model-based check: the pigeonhole tables answer exactly what a linear scan
// over every stored fingerprint answers (k <= 3), on random and near inputs.
import { expect, test } from 'bun:test'
import { emptyFingerprints, isNearDuplicate, remember } from '../../src/lib/fingerprints.ts'
import { popcount32 } from '../../src/lib/simhash.ts'

const seeded = (seed: number) => () => {
  seed ^= seed << 13
  seed ^= seed >>> 17
  seed ^= seed << 5
  return seed >>> 0
}

test('pigeonhole lookup equals a linear scan', () => {
  const next = seeded(0x1234567)
  const index = emptyFingerprints()
  const stored: [number, number][] = []
  const flip = ([lo, hi]: [number, number], bits: number): [number, number] => {
    let a = lo
    let b = hi
    for (let i = 0; i < bits; i++) {
      const bit = next() % 64
      if (bit < 32) a ^= 1 << bit
      else b ^= 1 << (bit - 32)
    }
    return [a >>> 0, b >>> 0]
  }
  let hits = 0
  for (let step = 0; step < 3000; step++) {
    const base = stored[next() % Math.max(1, stored.length)]
    const probe: [number, number] = base && step % 2 ? flip(base, next() % 6) : [next(), next()]
    const scan = stored.some(
      ([lo, hi]) => popcount32(lo ^ probe[0]) + popcount32(hi ^ probe[1]) <= 3,
    )
    expect(isNearDuplicate(index, probe[0], probe[1])).toBe(scan)
    if (scan) hits++
    else {
      remember(index, probe[0], probe[1])
      stored.push(probe)
    }
  }
  expect(hits).toBeGreaterThan(300)
})
