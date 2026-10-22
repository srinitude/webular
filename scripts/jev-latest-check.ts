// mise run jev:latest-check: fails when the Jev docs list a release above JEV_LATEST_RELEASED.
// Not a dependency of default, test, or CI.
import { BunRuntime } from '@effect/platform-bun'
import { Console, Effect } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import { highestReleased, isHigher, JEV_LATEST_RELEASED } from '../src/lib/jev/model.ts'

const DOCS = 'https://docs.typesafe.ai/llms-full.txt'

const program = Effect.gen(function* () {
  const http = yield* HttpClient.HttpClient
  const text = yield* http.get(DOCS).pipe(Effect.flatMap((r) => r.text))
  const top = highestReleased(text)
  if (top === undefined)
    return yield* Effect.fail(new Error('no versioned Jev id in the docs models table'))
  if (isHigher(top, JEV_LATEST_RELEASED))
    return yield* Effect.fail(
      new Error(
        `TypeSafe released ${top}, above ${JEV_LATEST_RELEASED}; review the docs and update the pin`,
      ),
    )
  yield* Console.log(`jev:latest-check ok: highest released ${top}, pinned ${JEV_LATEST_RELEASED}`)
})

// runMain sets a non-zero exit code when the program fails.
program.pipe(
  Effect.tapError((e) => Console.error(`jev:latest-check failed: ${e.message}`)),
  Effect.provide(FetchHttpClient.layer),
  BunRuntime.runMain,
)
