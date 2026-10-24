// Update notice, like gh and npm: one stderr line after a command when the
// registry's latest webular is above the installed one. It reads a cached
// {checkedAt, latest}; a cache past one day refreshes in the background with a
// 1.5 s cap, and every failure is silent.
import * as BunServices from '@effect/platform-bun/BunServices'
import { Clock, Config, Effect, Fiber, FileSystem, Path, Schema } from 'effect'
import pkg from '../../package.json' with { type: 'json' }
import { httpGet } from '../core/http.ts'
import { upgradeFor } from '../release/upgrade.ts'

const LATEST_URL = 'https://registry.npmjs.org/webular/latest'
const DAY_MS = 24 * 60 * 60 * 1000
const TIMEOUT_MS = 1500

const Cached = Schema.Struct({ checkedAt: Schema.Number, latest: Schema.String })
const Latest = Schema.Struct({ version: Schema.String })
const decodeCached = Schema.decodeUnknownEffect(Schema.fromJsonString(Cached))
const decodeLatest = Schema.decodeUnknownEffect(Latest)

export interface NoticeInput {
  argv: readonly string[]
  env: Readonly<Record<string, string>>
  isTTY: boolean
  current: string
}

// Off for WEBULAR_NO_UPDATE_NOTIFIER=1, CI, a pipe, JSON output, agent mode, or a prerelease.
const noticeOff = ({ argv, env, isTTY, current }: NoticeInput): boolean =>
  env['WEBULAR_NO_UPDATE_NOTIFIER'] === '1' ||
  (env['CI'] ?? '') !== '' ||
  !isTTY ||
  argv.includes('--json') ||
  argv.includes('--ndjson') ||
  env['WEBULAR_AGENT_MODE'] === '1' ||
  argv[0] === 'mcp' ||
  current.includes('-')

// The line to print, or undefined unless the cached version is above the installed one.
export const noticeLine = (input: NoticeInput, latest: string | undefined, upgrade: string) =>
  !noticeOff(input) && latest !== undefined && Bun.semver.order(latest, input.current) === 1
    ? `A newer webular is out: ${latest} (you have ${input.current}). Run: ${upgrade}`
    : undefined

const env = (name: string) => Config.String(name).pipe(Config.withDefault(''))

const noticeInput = (argv: readonly string[]) =>
  Effect.gen(function* () {
    const input: NoticeInput = {
      argv,
      isTTY: process.stderr.isTTY === true,
      current: pkg.version,
      env: {
        WEBULAR_NO_UPDATE_NOTIFIER: yield* env('WEBULAR_NO_UPDATE_NOTIFIER'),
        CI: yield* env('CI'),
        WEBULAR_AGENT_MODE: yield* env('WEBULAR_AGENT_MODE'),
      },
    }
    return input
  })

// WEBULAR_CACHE_DIR/update-check.json (default ~/.cache/webular), plus its cached value.
const readCache = Effect.gen(function* () {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const home = yield* env('HOME')
  const dir = (yield* env('WEBULAR_CACHE_DIR')) || path.join(home, '.cache', 'webular')
  const file = path.join(dir, 'update-check.json')
  const cached = yield* fs.readFileString(file).pipe(
    Effect.flatMap(decodeCached),
    Effect.map((c): typeof Cached.Type | undefined => c),
    Effect.orElseSucceed(() => undefined),
  )
  return { dir, file, cached }
})

const refresh = (dir: string, file: string, now: number) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const res = yield* httpGet(LATEST_URL, { timeoutMs: TIMEOUT_MS })
    const { version } = yield* decodeLatest(yield* Effect.tryPromise(() => res.json()))
    yield* fs.makeDirectory(dir, { recursive: true })
    yield* fs.writeFileString(file, JSON.stringify({ checkedAt: now, latest: version }))
  }).pipe(Effect.timeout(TIMEOUT_MS), Effect.ignore)

const upgradeCommand = Effect.map(
  env('WEBULAR_INSTALL'),
  (install) =>
    upgradeFor([process.execPath, process.argv[1] ?? ''], { WEBULAR_INSTALL: install }).command,
)

// Runs the command, then prints the notice from the cache and waits out what is
// left of the refresh's 1.5 s cap. A missing cache shows nothing this run.
export const withUpdateNotice = <A, E, R>(argv: readonly string[], task: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const input = yield* noticeInput(argv)
    if (noticeOff(input)) return yield* task
    const { dir, file, cached } = yield* readCache
    const now = yield* Clock.currentTimeMillis
    const stale = cached === undefined || now - cached.checkedAt > DAY_MS
    const fiber = stale ? yield* Effect.forkChild(refresh(dir, file, now)) : undefined
    const result = yield* task
    const line = noticeLine(input, cached?.latest, yield* upgradeCommand)
    if (line) yield* Effect.sync(() => process.stderr.write(`${line}\n`))
    if (fiber) yield* Fiber.join(fiber)
    return result
  }).pipe(
    Effect.catchTag('ConfigError', () => task),
    Effect.provide(BunServices.layer),
  )
