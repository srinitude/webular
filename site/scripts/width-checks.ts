// Runs every per-page probe at one width and tallies pass and fail per check.
// Layout probes run once (light theme); axe runs in the light and dark themes.
import { Effect } from 'effect'
import type { Browser, Page } from 'playwright'
import {
  axeIssues,
  heroOnScreen,
  missingFocusRings,
  scrollsSideways,
  smallTargets,
} from './page-probes.ts'
import { openPage, PAGES, type Theme, urlOf } from './site-browser.ts'

export const CHECKS = [
  'no sideways scroll',
  'targets 44px',
  'focus ring',
  'hero command',
  'axe light',
  'axe dark',
] as const
export type Check = (typeof CHECKS)[number]
export type Tally = { pass: number; fail: number; failures: string[] }

const record = (tally: Map<Check, Tally>, check: Check, where: string, found: string[]) => {
  const t = tally.get(check) ?? { pass: 0, fail: 0, failures: [] }
  if (found.length === 0) t.pass++
  else {
    t.fail++
    t.failures.push(...found.map((f) => `${where}: ${f}`))
  }
  tally.set(check, t)
}

const layoutProbes = (page: Page, name: string, width: number, tally: Map<Check, Tally>) =>
  Effect.gen(function* () {
    const where = `${name} at ${width}px`
    record(tally, 'no sideways scroll', where, (yield* scrollsSideways(page)) ? ['scrolls'] : [])
    record(tally, 'targets 44px', where, yield* smallTargets(page))
    if (name === 'index')
      record(tally, 'hero command', where, (yield* heroOnScreen(page, width)) ? [] : ['off screen'])
    record(tally, 'focus ring', where, yield* missingFocusRings(page))
  })

const themePass = (
  b: Browser,
  base: string,
  width: number,
  theme: Theme,
  tally: Map<Check, Tally>,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const page = yield* openPage(b, width, theme)
      for (const name of PAGES) {
        yield* Effect.tryPromise(() => page.goto(urlOf(base, name)))
        record(tally, `axe ${theme}`, `${name} at ${width}px`, yield* axeIssues(page))
        if (theme === 'light') yield* layoutProbes(page, name, width, tally)
      }
    }),
  )

export const checkWidth = (b: Browser, base: string, width: number) =>
  Effect.gen(function* () {
    const tally = new Map<Check, Tally>()
    yield* themePass(b, base, width, 'light', tally)
    yield* themePass(b, base, width, 'dark', tally)
    return tally
  })
