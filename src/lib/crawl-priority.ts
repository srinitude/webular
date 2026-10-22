// Count-based crawl priority: 0 is crawled first, 2 last. Paths and hosts that
// yielded useful pages rise, paths that yielded none sink, and pagination,
// archive, and category URL shapes rise. Plain counts, no model.
interface YieldStats {
  tried: number
  useful: number
}
export type Yields = Map<string, YieldStats>

const SHAPE = /\/(page|archive|archives|category|categories|tag|tags)(\/|$)|[?&](page|paged)=\d+/i
const OPAQUE = /^(\d+|[0-9a-f]{8,})$/i

/** The URL's directory with numeric and hash-like segments folded to `*`. */
const patternOf = (u: URL) =>
  u.pathname
    .split('/')
    .filter(Boolean)
    .slice(0, -1)
    .map((s) => (OPAQUE.test(s) ? '*' : s))
    .join('/')

const keysOf = (url: string) => {
  const u = URL.parse(url)
  return u
    ? {
        host: u.host,
        pattern: `${u.host}/${patternOf(u)}`,
        shaped: SHAPE.test(u.pathname + u.search),
      }
    : null
}

/** Counts one fetched page against its path pattern and its host. */
export const countVisit = (y: Yields, url: string, useful: boolean) => {
  const k = keysOf(url)
  if (!k) return
  for (const key of [k.pattern, k.host]) {
    const s = y.get(key) ?? { tried: 0, useful: 0 }
    s.tried++
    if (useful) s.useful++
    y.set(key, s)
  }
}

export const priorityOf = (y: Yields, url: string, fresh = false) => {
  const k = keysOf(url)
  if (!k) return 1
  const s = y.get(k.pattern) ?? y.get(k.host)
  let rank = 1
  if (s && s.useful >= 2 && s.useful * 2 >= s.tried) rank = 0
  else if (s && s.tried >= 3 && s.useful === 0) rank = 2
  return Math.max(0, rank - (k.shaped || fresh ? 1 : 0))
}
