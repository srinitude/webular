import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { CANARY } from './generate-common'
import { TASKS } from './generate-crawl'
import { SITES } from './generate-crawl-model'

const root = `${import.meta.dir}/../../..`
const caps = { small: 50, medium: 500, large: 5000 } as const

test('30 sites, 10 per size, each under its page cap', () => {
  expect(SITES.length).toBe(30)
  for (const size of ['small', 'medium', 'large'] as const) {
    const group = SITES.filter((s) => s.size === size)
    expect(group.length).toBe(10)
    expect(group.every((s) => s.pages.length < caps[size])).toBe(true)
    const withMap = group.filter((s) => s.sitemap).length
    expect(withMap).toBeGreaterThanOrEqual(3)
    expect(withMap).toBeLessThanOrEqual(7)
    expect(new Set(group.map((s) => s.scope)).size).toBe(4)
  }
})

test('domain mix: 8+ domains, none over 20%, some non-English', () => {
  const counts = Map.groupBy(TASKS, (t) => t.tags.domain)
  expect(counts.size).toBeGreaterThanOrEqual(8)
  expect(Math.max(...[...counts.values()].map((g) => g.length))).toBeLessThanOrEqual(6)
  expect(TASKS.some((t) => t.tags.language !== 'en')).toBe(true)
})

test(
  'gold URLs exist on disk and every fixture file carries the canary',
  () =>
    Effect.runPromise(
      Effect.forEach(
        SITES,
        (site) =>
          Effect.tryPromise(async () => {
            expect(site.gold.length).toBeGreaterThan(0)
            for (const p of site.gold) {
              const text = await Bun.file(`${root}/bench/fixtures/sites/${site.name}${p}`).text()
              expect(text).toContain(CANARY)
            }
            for (const p of ['/old-home.html', '/js/hidden.html', '/orphan.html']) {
              expect(
                await Bun.file(`${root}/bench/fixtures/sites/${site.name}${p}`).text(),
              ).toContain(CANARY)
            }
          }),
        { concurrency: 16, discard: true },
      ),
    ),
  60_000,
)
