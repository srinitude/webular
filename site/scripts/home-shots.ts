// Screenshots of the built home, install, docs, and 404 pages at 390, 1024, and
// 1440 px, in the light theme, into site/dist-shots/ (git-ignored) for a by-eye
// design review.
import { BunRuntime } from '@effect/platform-bun'
import { Console, Effect } from 'effect'
import { browser, openPage, server } from './site-browser.ts'

const SHOTS = new URL('../dist-shots/', import.meta.url).pathname
const SHOT_WIDTHS = [390, 1024, 1440] as const
// [shot name, path]
const SHOT_PAGES = [
  ['home', '/'],
  ['install', '/install'],
  ['docs', '/docs'],
  ['404', '/404'],
] as const
const shots = SHOT_WIDTHS.flatMap((width) => SHOT_PAGES.map((page) => [width, ...page] as const))

const program = Effect.gen(function* () {
  const s = yield* server
  const b = yield* browser
  yield* Effect.forEach(
    shots,
    ([width, name, route]) =>
      Effect.scoped(
        Effect.gen(function* () {
          const page = yield* openPage(b, width, 'light')
          yield* Effect.tryPromise(() => page.goto(`http://localhost:${s.port}${route}`))
          const path = `${SHOTS}${name}-${width}.png`
          yield* Effect.tryPromise(() => page.screenshot({ path, fullPage: true }))
          yield* Console.log(path)
        }),
      ),
    { concurrency: 1, discard: true },
  )
})

program.pipe(Effect.scoped, BunRuntime.runMain)
