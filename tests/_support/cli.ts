// One spawn helper for every command test — stdout/stderr drain CONCURRENTLY
// (sequential drains deadlock once a pipe passes 64KB; see src/core/proc.ts).
import { Effect, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
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

// An explicit env replaces the parent's; no env inherits it.
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
          env: opts.env,
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
