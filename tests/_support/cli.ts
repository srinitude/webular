// One spawn helper for every command test — stdout/stderr drain CONCURRENTLY
// (sequential drains deadlock once a pipe passes 64KB; see src/core/proc.ts).
import { Effect, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { exitCodeOf, IN_PROCESS } from '../../src/core/effect.ts'
import { ROOT } from './root.ts'

export interface CliResult {
  code: number
  out: string
  err: string
}

export interface CliOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  exec?: string
}

const text = <E>(s: Stream.Stream<Uint8Array, E>) => Stream.mkString(Stream.decodeText(s))

// An explicit env replaces the parent's; no env inherits it. A child skips the
// HTTP disk cache unless the caller sets WEBULAR_NO_CACHE, so no command test
// writes .cache/webular (into HOME, or into the repo when HOME is unset).
// A child runs with Jev off unless the caller's env sets WEBULAR_JEV, so no
// command test reads the Keychain key or waits on a live docs guard and Jev call.
export const runCli = (
  entry: string,
  args: string[],
  opts: CliOptions = {},
): Effect.Effect<CliResult, Error, ChildProcessSpawner.ChildProcessSpawner> =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const handle = yield* spawner.spawn(
        ChildProcess.make(opts.exec ?? 'bun', [`${ROOT}${entry}`, ...args], {
          cwd: opts.cwd ?? ROOT,
          env: { WEBULAR_JEV: 'off', ...(opts.env && { WEBULAR_NO_CACHE: '1', ...opts.env }) },
          extendEnv: opts.env === undefined,
          detached: false,
        }),
      )
      const [out, err, code] = yield* Effect.all(
        [text(handle.stdout), text(handle.stderr), handle.exitCode],
        { concurrency: 3 },
      )
      return { code: Number(code), out, err }
    }),
  ).pipe(Effect.mapError((e) => new Error(e.message)))

// The same command run in this process: the entry's runMain hands its program
// to the IN_PROCESS seam, which runs it with runCli's argv, env, and cwd while
// stdout and stderr are captured. Calls run one at a time (globals are swapped).
// Keep one runCli spawn per surface as the real-process smoke test.
type Write = typeof process.stdout.write
let loads = 0

const swapGlobals = (entry: string, args: string[], opts: CliOptions) =>
  Effect.sync(() => {
    const out: string[] = []
    const err: string[] = []
    const capture =
      (sink: string[]): Write =>
      (chunk: string | Uint8Array, ...rest: unknown[]) => {
        sink.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk))
        const done = rest.find((r) => typeof r === 'function') as (() => void) | undefined
        done?.()
        return true
      }
    const saved = {
      argv: [...process.argv],
      env: { ...process.env },
      cwd: process.cwd(),
      out: process.stdout.write,
      err: process.stderr.write,
      outTTY: process.stdout.isTTY,
      errTTY: process.stderr.isTTY,
    }
    const env = opts.env
      ? { WEBULAR_JEV: 'off', WEBULAR_NO_CACHE: '1', ...opts.env }
      : { ...process.env, WEBULAR_JEV: 'off' }
    process.argv.splice(0, process.argv.length, process.execPath, `${ROOT}${entry}`, ...args)
    for (const key of Object.keys(process.env)) delete process.env[key]
    for (const [key, value] of Object.entries(env))
      if (value !== undefined) process.env[key] = value
    process.chdir(opts.cwd ?? ROOT)
    process.stdout.write = capture(out)
    process.stderr.write = capture(err)
    process.stdout.isTTY = false
    process.stderr.isTTY = false
    const restore = Effect.sync(() => {
      process.argv.splice(0, process.argv.length, ...saved.argv)
      for (const key of Object.keys(process.env)) delete process.env[key]
      Object.assign(process.env, saved.env)
      process.chdir(saved.cwd)
      process.stdout.write = saved.out
      process.stderr.write = saved.err
      process.stdout.isTTY = saved.outTTY
      process.stderr.isTTY = saved.errTTY
    })
    return { out, err, restore }
  })

const loadProgram = (entry: string) =>
  Effect.gen(function* () {
    const seen: { program?: Parameters<typeof exitCodeOf>[0] } = {}
    const slot = globalThis as { [IN_PROCESS]?: (p: Parameters<typeof exitCodeOf>[0]) => void }
    slot[IN_PROCESS] = (program) => {
      seen.program = program
    }
    yield* Effect.tryPromise({
      try: () => import(`${ROOT}${entry}?in-process=${++loads}`),
      catch: (e) => new Error(`${entry}: import failed: ${String(e)}`),
    }).pipe(Effect.ensuring(Effect.sync(() => delete slot[IN_PROCESS])))
    if (!seen.program) return yield* Effect.fail(new Error(`${entry} never called runMain`))
    return seen.program
  })

export const runInProcess = (
  entry: string,
  args: string[],
  opts: Omit<CliOptions, 'exec'> = {},
): Effect.Effect<CliResult, Error> =>
  Effect.acquireUseRelease(
    swapGlobals(entry, args, opts),
    ({ out, err }) =>
      Effect.map(Effect.flatMap(loadProgram(entry), exitCodeOf), (code) => ({
        code,
        out: out.join(''),
        err: err.join(''),
      })),
    ({ restore }) => restore,
  )
