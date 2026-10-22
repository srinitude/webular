// In-page probes for one loaded page: sideways scroll, target size, focus
// ring, hero command, and axe. Each returns the failures it found.
import { AxeBuilder } from '@axe-core/playwright'
import { Effect } from 'effect'
import type { Page } from 'playwright'
import { HEIGHT } from './site-browser.ts'

const MIN_TARGET = 44
const MAX_TABS = 12
const TARGETS = 'a[href],button,input,select,textarea,summary,[role=button],[tabindex]'

export const scrollsSideways = (page: Page) =>
  Effect.tryPromise(() =>
    page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  )

// WCAG target-size inline exception: a link inside a run of text sizes with the text.
const probeTargets = ([sel, min]: [string, number]) => {
  const tooSmall = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    if (getComputedStyle(el).display === 'inline' && el.closest('p,li,dd,td')) return false
    return r.width < min || r.height < min
  }
  const describe = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const label = (el.textContent ?? '').trim().slice(0, 30)
    return `${el.tagName.toLowerCase()} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`
  }
  return [...document.querySelectorAll<HTMLElement>(sel)].filter(tooSmall).map(describe)
}

export const smallTargets = (page: Page) =>
  Effect.tryPromise(() => page.evaluate(probeTargets, [TARGETS, MIN_TARGET] as [string, number]))

const probeRing = () => {
  const el = document.activeElement
  if (!el || el === document.body) return null
  const s = getComputedStyle(el)
  const outline = s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) > 0
  if (outline || s.boxShadow !== 'none') return ''
  return `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`
}

// Tabs through the page with the keyboard and checks each focused element.
export const missingFocusRings = (page: Page) =>
  Effect.gen(function* () {
    const misses: string[] = []
    for (let i = 0; i < MAX_TABS; i++) {
      yield* Effect.tryPromise(() => page.keyboard.press('Tab'))
      const miss = yield* Effect.tryPromise(() => page.evaluate(probeRing))
      if (miss === null) break
      if (miss) misses.push(miss)
    }
    return [...new Set(misses)]
  })

export const heroOnScreen = (page: Page, width: number) =>
  Effect.gen(function* () {
    const hero = page.locator('#hero-command')
    const visible = yield* Effect.tryPromise(() => hero.isVisible())
    const box = yield* Effect.tryPromise(() => hero.boundingBox())
    return visible && !!box && box.y + box.height <= HEIGHT && box.x + box.width <= width
  })

export const axeIssues = (page: Page) =>
  Effect.tryPromise(() => new AxeBuilder({ page }).analyze()).pipe(
    Effect.map(({ violations }) =>
      violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.impact} ${v.id} ${v.help} (${v.nodes.length} nodes)`),
    ),
  )
