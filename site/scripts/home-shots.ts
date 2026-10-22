// Screenshots of the built home page at 390, 1024, and 1440 px, in the light
// theme, into site/dist-shots/ (git-ignored) for a by-eye design review.
import { BunRuntime } from '@effect/platform-bun'
import { Console, Effect } from 'effect'
import { browser, openPage, server } from './site-browser.ts'

const SHOTS = new URL('../dist-shots/', import.meta.url).pathname
const SHOT_WIDTHS = [390, 1024, 1440] as const

const program = Effect.gen(function* () {
  const s = yield* server
  const b = yield* browser
  yield* Effect.forEach(
    SHOT_WIDTHS,
    (width) =>
      Effect.scoped(
        Effect.gen(function* () {
          const page = yield* openPage(b, width, 'light')
          yield* Effect.tryPromise(() => page.goto(`http://localhost:${s.port}/`))
          const path = `${SHOTS}home-${width}.png`
          yield* Effect.tryPromise(() => page.screenshot({ path, fullPage: true }))
          yield* Console.log(path)
        }),
      ),
    { concurrency: 1, discard: true },
  )
})

program.pipe(Effect.scoped, BunRuntime.runMain)
