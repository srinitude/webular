// Guard: when the clipboard rejects writeText, the home run line's Copy button shows the
// design's copy_failed text, the polite live region says it with the hand-copy hint, the
// run line stays selectable, and the longer label adds no sideways scroll at 320 px.
// site/dist exists only after `mise run site:build`; without it the test passes untouched.

import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { browser, DIST, openPage, server, urlOf } from '../../site/scripts/site-browser.ts'
import { eff } from '../_support/run.ts'

type Page = Effect.Success<ReturnType<typeof openPage>>

// Runs in the page before its script: a clipboard whose writeText always rejects,
// as on a denied permission.
const REJECT_CLIPBOARD = `Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
})`

// Click the first Copy, wait for the failure text, then read what a visitor and a
// screen reader get.
const copyAndRead = (page: Page) => {
  const region = page.locator('[data-copy-region]').first()
  const button = region.locator('button[data-copy]')
  const status = region.locator('[data-copy-status]')
  return Effect.tryPromise(() => button.click()).pipe(
    Effect.andThen(() =>
      Effect.tryPromise(() => status.filter({ hasText: 'Copy did not work' }).waitFor()),
    ),
    Effect.andThen(() =>
      Effect.all(
        {
          button: Effect.tryPromise(() => button.textContent()),
          status: Effect.tryPromise(() => status.textContent()),
          live: Effect.tryPromise(() => status.getAttribute('aria-live')),
          select: Effect.tryPromise(() =>
            region.locator('pre').evaluate((el) => getComputedStyle(el).userSelect),
          ),
          sideways: Effect.tryPromise(() =>
            page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
          ),
        },
        { concurrency: 1 },
      ),
    ),
  )
}

test(
  'a rejected copy shows and announces copy_failed',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      if (!(yield* fs.exists(DIST))) return
      const s = yield* server
      const page = yield* openPage(yield* browser, 320, 'light')
      yield* Effect.tryPromise(() => page.addInitScript({ content: REJECT_CLIPBOARD }))
      yield* Effect.tryPromise(() => page.goto(urlOf(`http://localhost:${s.port}`, 'index')))
      expect(yield* copyAndRead(page)).toEqual({
        button: 'Copy did not work',
        status: 'Copy did not work. Select the line by hand and copy it.',
        live: 'polite',
        select: 'auto',
        sideways: false,
      })
    }),
  ),
  60000,
)
