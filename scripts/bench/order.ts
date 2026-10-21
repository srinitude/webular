// Seeded, interleaved run order (latency protocol, audit findings 9 and 11).
// Per task every provider runs in a shuffled order, then in reverse, so each
// timed pair runs A B B A and drift cancels.

export interface Slot {
  readonly taskId: string
  readonly provider: string
}

// mulberry32: small, fast, deterministic for a given seed.
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const shuffle = <A>(items: ReadonlyArray<A>, rand: () => number): A[] => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j] as A, out[i] as A]
  }
  return out
}

export const schedule = (
  seed: number,
  taskIds: ReadonlyArray<string>,
  providers: ReadonlyArray<string>,
): Slot[] => {
  const rand = mulberry32(seed)
  return shuffle(taskIds, rand).flatMap((taskId) => {
    const order = shuffle(providers, rand)
    return [...order, ...order.toReversed()].map((provider) => ({ taskId, provider }))
  })
}

const checkBlock = (
  block: ReadonlyArray<Slot>,
  providers: ReadonlyArray<string>,
  taskId: string,
) => {
  const n = providers.length
  const names = block.map((s) => s.provider)
  const first = names.slice(0, n)
  const okTask = block.every((s) => s.taskId === taskId)
  const okPerm = new Set(first).size === n && providers.every((p) => first.includes(p))
  const okAbba = names.slice(n).join('\n') === first.toReversed().join('\n')
  return okTask && okPerm && okAbba
    ? []
    : [`task ${taskId}: block is not an interleaved ABBA order`]
}

// Problems in a run log: a task split across blocks, or a block that is not a
// full provider permutation followed by its reverse (ABBA).
export const checkLog = (log: ReadonlyArray<Slot>, providers: ReadonlyArray<string>): string[] => {
  const n = providers.length
  const problems: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < log.length; i += 2 * n) {
    const block = log.slice(i, i + 2 * n)
    const taskId = block[0]?.taskId ?? ''
    if (seen.has(taskId)) problems.push(`task ${taskId} is not interleaved in one block`)
    seen.add(taskId)
    problems.push(...checkBlock(block, providers, taskId))
  }
  return problems
}
