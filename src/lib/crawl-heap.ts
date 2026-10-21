// Binary min-heap of hosts keyed by next-allowed time.
interface Slot {
  readonly host: string
  readonly at: number
}
const at = (a: Slot[], i: number) => (a[i] as Slot).at

/** Binary min-heap by `at`: push and pop O(log H). */
export class HostHeap {
  readonly items: Slot[] = []
  push(slot: Slot) {
    const a = this.items
    let i = a.push(slot) - 1
    while (i > 0 && at(a, (i - 1) >> 1) > slot.at) {
      a[i] = a[(i - 1) >> 1] as Slot
      i = (i - 1) >> 1
    }
    a[i] = slot
  }
  pop(): Slot | undefined {
    const a = this.items
    const top = a[0]
    const last = a.pop()
    if (a.length === 0 || !last) return top
    let i = 0
    for (let l = 1; l < a.length; l = 2 * i + 1) {
      const c = l + 1 < a.length && at(a, l + 1) < at(a, l) ? l + 1 : l
      if (at(a, c) >= last.at) break
      a[i] = a[c] as Slot
      i = c
    }
    a[i] = last
    return top
  }
}
