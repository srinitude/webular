// Optional page screenshot beside a render. Off unless WEBULAR_SCREENSHOT=1, so
// no MCP input changes. A failed, timed-out, or oversize screenshot is dropped:
// the render result still returns, without it. The file goes in a scoped temp
// dir (the TMPDIR the platform layer reads), read back, and removed on exit.
import * as BunServices from '@effect/platform-bun/BunServices'
import { Config, Effect, FileSystem, Path } from 'effect'
import { runBatch } from './agentbrowser.ts'

// The capture cap the media workflow already uses for screenshots and PDFs.
export const MAX_CAPTURE_BYTES = 50 * 1024 * 1024
// Half of runBatch's 60 s: a screenshot waits on one paint, not a page load.
const SCREENSHOT_TIMEOUT_MS = 30_000

export const screenshotOn = Config.Boolean('WEBULAR_SCREENSHOT').pipe(
  Config.withDefault(false),
  Effect.orElseSucceed(() => false),
)

const capture = (session: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const file = path.join(
        yield* fs.makeTempDirectoryScoped({ prefix: 'webular-shot-' }),
        'page.jpg',
      )
      const res = yield* runBatch(
        [['screenshot', '--full', '--screenshot-format', 'jpeg', file]],
        session,
        SCREENSHOT_TIMEOUT_MS,
      )
      if (res.code !== 0) return undefined
      if (Number((yield* fs.stat(file)).size) > MAX_CAPTURE_BYTES) return undefined
      return yield* fs.readFile(file)
    }),
  )

export const maybeScreenshot = (session: string) =>
  Effect.flatMap(screenshotOn, (on) =>
    on
      ? capture(session).pipe(
          Effect.provide(BunServices.layer),
          Effect.orElseSucceed(() => undefined),
        )
      : Effect.succeed(undefined),
  )
