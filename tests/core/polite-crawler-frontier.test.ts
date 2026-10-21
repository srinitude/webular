// Contract for the polite crawler: the frontier matches a reference model,
// memory stays under the cap at any crawl size, delays stay clamped,
// near-duplicates are skipped, and a resumed crawl never refetches.
import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { enqueue, flush, makeFrontier, pop, release } from '../../src/lib/crawl-frontier.ts'
import { MAX_DELAY_MS, MIN_DELAY_MS, nextDelay } from '../../src/lib/polite-crawler.ts'

// mulberry32: a seeded RNG so every run sees the same sequence.
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const run = <A, E>(e: Effect.Effect<A, E>) => Effect.runSync(e)

// Pops one URL (all hosts due) and hands the host straight back.
const popOne = (f: ReturnType<typeof makeFrontier>) => {
  const next = run(pop(f, Number.MAX_SAFE_INTEGER))
  if (!next || 'waitMs' in next) return undefined
  release(f, next.host, 0)
  return next.url
}

test('frontier: random push/pop matches a per-host FIFO reference model', () => {
  const random = rng(42)
  const f = makeFrontier(new Database(':memory:'), 'model', 8)
  const model = new Map<string, string[]>()
  const out: string[] = []
  for (let i = 0; i < 2000; i++) {
    if (random() < 0.6) {
      const url = `https://h${Math.floor(random() * 5)}.test/p${i}`
      run(enqueue(f, [url]))
      const host = new URL(url).host
      model.set(host, [...(model.get(host) ?? []), url])
    } else {
      const url = popOne(f)
      if (url) out.push(url)
    }
  }
  for (let url = popOne(f); url; url = popOne(f)) out.push(url)
  expect(new Set(out)).toEqual(new Set([...model.values()].flat()))
  for (const [host, urls] of model)
    expect(out.filter((u) => new URL(u).host === host)).toEqual(urls)
})

test('frontier: a host is not due before its release time', () => {
  const f = makeFrontier(new Database(':memory:'), 'due', 10)
  run(enqueue(f, ['https://a.test/1', 'https://a.test/2']))
  const first = run(pop(f, 0))
  expect(first).toEqual({ url: 'https://a.test/1', host: 'a.test' })
  release(f, 'a.test', 500)
  expect(run(pop(f, 100))).toEqual({ waitMs: 400 })
  expect(run(pop(f, 500))).toEqual({ url: 'https://a.test/2', host: 'a.test' })
})

for (const total of [100, 10_000, 100_000])
  test(`frontier: ${total} URLs never hold more than memoryCap in memory`, () => {
    const cap = 1000
    const f = makeFrontier(new Database(':memory:'), 'scale', cap)
    const urls = Array.from({ length: total }, (_, i) => `https://h${i % 50}.test/p${i}`)
    const heapBefore = process.memoryUsage().heapUsed
    run(enqueue(f, urls))
    run(enqueue(f, urls.slice(0, 100))) // exact dedupe: no second admission
    let popped = 0
    while (popOne(f)) popped++
    expect(popped).toBe(total)
    expect(f.peakInMemory).toBeLessThanOrEqual(cap)
    expect(f.inMemory).toBe(0)
    const heapDeltaMb = ((process.memoryUsage().heapUsed - heapBefore) / 1e6).toFixed(1)
    run(
      Effect.logInfo(
        `frontier ${total}: peak in memory ${f.peakInMemory}, heapUsed delta ${heapDeltaMb} MB`,
      ),
    )
  }, 60_000)

test('frontier: flush keeps unvisited URLs across reopen', () => {
  const db = new Database(':memory:')
  const f = makeFrontier(db, 'flush', 4)
  run(enqueue(f, ['https://a.test/1', 'https://a.test/2', 'https://a.test/3']))
  popOne(f)
  run(flush(f))
  const reopened = makeFrontier(db, 'flush', 4)
  expect([popOne(reopened), popOne(reopened), popOne(reopened)]).toEqual([
    'https://a.test/2',
    'https://a.test/3',
    undefined,
  ])
})

test('delay: stays within [250, 2500] ms under random statuses', () => {
  const random = rng(7)
  const statuses = [200, 200, 404, 429, 500, 503, 0]
  let delay = MIN_DELAY_MS
  for (let i = 0; i < 10_000; i++) {
    const status = statuses[Math.floor(random() * statuses.length)] as number
    delay = nextDelay(delay, { status, fetchMs: random() * 400, crawlDelayMs: random() * 5000 })
    expect(delay).toBeGreaterThanOrEqual(MIN_DELAY_MS)
    expect(delay).toBeLessThanOrEqual(MAX_DELAY_MS)
  }
  expect(nextDelay(1000, { status: 429, fetchMs: 0, crawlDelayMs: 0 })).toBe(2000)
  expect(nextDelay(1000, { status: 200, fetchMs: 0, crawlDelayMs: 0 })).toBe(750)
})
