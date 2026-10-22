// mise run repo:settings (apply) / repo:settings:check (read-only drift check):
// the GitHub repository description, homepage, and topics, held in
// .github/repo-settings.json. Not a dependency of default, test, or CI.

import { BunRuntime } from '@effect/platform-bun'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Console, Data, Effect, FileSystem, Schema } from 'effect'
import { runProc } from '../src/core/proc.ts'
import { PACKAGE_ROOT } from '../src/core/root.ts'

const REPO = 'srinitude/webular'
const FILE = `${PACKAGE_ROOT}.github/repo-settings.json`

class SettingsError extends Data.TaggedError('SettingsError')<{ readonly message: string }> {}

const gh = (args: string[], stdin?: string) =>
  runProc(['gh', 'api', ...args], {
    timeoutMs: 30_000,
    ...(stdin === undefined ? {} : { stdin }),
  }).pipe(
    Effect.flatMap((r) =>
      r.code === 0
        ? Effect.succeed(r.stdout)
        : Effect.fail(
            new SettingsError({ message: `gh api ${args.join(' ')}: ${r.stderr.trim()}` }),
          ),
    ),
  )

const Wanted = Schema.fromJsonString(
  Schema.Struct({
    description: Schema.String,
    homepage: Schema.String,
    topics: Schema.Array(Schema.String),
  }),
)
const Repo = Schema.fromJsonString(
  Schema.Struct({ description: Schema.String, homepage: Schema.NullOr(Schema.String) }),
)
const Topics = Schema.fromJsonString(Schema.Struct({ names: Schema.Array(Schema.String) }))

const wanted = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  return yield* Schema.decodeUnknownEffect(Wanted)(yield* fs.readFileString(FILE))
})

const check = Effect.gen(function* () {
  const want = yield* wanted
  const repo = yield* Schema.decodeUnknownEffect(Repo)(yield* gh([`repos/${REPO}`]))
  const { names: topics } = yield* Schema.decodeUnknownEffect(Topics)(
    yield* gh([`repos/${REPO}/topics`]),
  )
  const drift = [
    repo.description !== want.description && 'description',
    (repo.homepage ?? '') !== want.homepage && 'homepage',
    [...topics].sort().join() !== [...want.topics].sort().join() && 'topics',
  ].filter((f): f is string => f !== false)
  if (drift.length > 0)
    return yield* Effect.fail(
      new SettingsError({ message: `drifted from ${FILE}: ${drift.join(', ')}` }),
    )
  yield* Console.log('repo:settings:check ok: description, homepage, and topics match')
})

const apply = Effect.gen(function* () {
  const want = yield* wanted
  yield* gh(
    ['-X', 'PATCH', `repos/${REPO}`, '--input', '-'],
    JSON.stringify({ description: want.description, homepage: want.homepage }),
  )
  yield* gh(
    ['-X', 'PUT', `repos/${REPO}/topics`, '--input', '-'],
    JSON.stringify({ names: want.topics }),
  )
  yield* Console.log('repo:settings applied: description, homepage, and topics')
})

const mode = process.argv[2]
const program =
  mode === 'apply'
    ? apply
    : mode === 'check'
      ? check
      : Effect.fail(new SettingsError({ message: 'usage: repo-settings.ts apply|check' }))

// runMain sets a non-zero exit code when the program fails.
program.pipe(
  Effect.tapError((e) => Console.error(`repo:settings failed: ${e.message}`)),
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
)
