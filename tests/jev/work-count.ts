// Work counts for complexity checks: wrap an input so every property read, key
// listing, and own-key check it gets is counted. Unlike wall time, a count is
// exact and the same on every machine and every run, so a flat count proves the
// walk is bounded instead of showing one timing that happened to be fast.
export interface WorkCount {
  reads: number
  listings: number
  keyChecks: number
}

export const newCount = (): WorkCount => ({ reads: 0, listings: 0, keyChecks: 0 })

// Frozen values (interned purposes) pass through unwrapped: they are constants.
export const counted = <T>(root: T, c: WorkCount): T => {
  const wrap = (o: object): object =>
    new Proxy(o, {
      get: (t, k, r) => {
        c.reads++
        const v: unknown = Reflect.get(t, k, r)
        return typeof v === 'object' && v !== null && !Object.isFrozen(v) ? wrap(v) : v
      },
      ownKeys: (t) => {
        c.listings++
        return Reflect.ownKeys(t)
      },
      getOwnPropertyDescriptor: (t, k) => {
        c.keyChecks++
        return Reflect.getOwnPropertyDescriptor(t, k)
      },
    })
  return typeof root === 'object' && root !== null ? (wrap(root) as T) : root
}

export const total = (c: WorkCount) => c.reads + c.listings + c.keyChecks
