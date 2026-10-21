// Shared subprocess runner: argv arrays only (no shell), mandatory timeout,
// and CONCURRENT stdout/stderr draining — a child that fills one pipe past
// 64KB while the parent awaits the other deadlocks, so both drain together.
import { constants } from 'node:os'
import { Data, Effect, Option, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { errMsg } from './output.ts'

export class ProcError extends Data.TaggedError('ProcError')<{ readonly message: string }> {}

interface ProcResult {
  code: number
  stdout: string
  stderr: string
  timedOut: boolean
}

interface ProcOptions {
  timeoutMs: number
  cwd?: string
  stdin?: string
  // Replaces the inherited environment when set; absent inherits ours.
  env?: Record<string, string>
  // Merges env over ours instead of replacing it.
  extendEnv?: boolean
}

const SIGTERM_CODE = 128 + constants.signals.SIGTERM

// The spawner fails exitCode for a child killed by a signal; report the shell
// convention 128 + signal number instead, like any other non-zero exit.
const signalCode = (err: unknown): number => {
  const name = /'(SIG[A-Z0-9]+)'/.exec(errMsg(err))?.[1] as keyof typeof constants.signals
  return 128 + (constants.signals[name] ?? 0)
}

const text = <E>(s: Stream.Stream<Uint8Array, E>) => Stream.mkString(Stream.decodeText(s))

// detached: false keeps the child in our process group, so Ctrl-C reaches it.
const toCommand = ([cmd, ...args]: [string, ...string[]], opts: ProcOptions) =>
  ChildProcess.make(cmd, args, {
    cwd: opts.cwd,
    env: opts.env,
    extendEnv: opts.extendEnv,
    detached: false,
    stdin: opts.stdin === undefined ? 'ignore' : Stream.make(new TextEncoder().encode(opts.stdin)),
  })

// Closing the scope (timeout or interruption) kills a child still running.
export function runProc(
  argv: [string, ...string[]],
  opts: ProcOptions,
): Effect.Effect<ProcResult, ProcError, ChildProcessSpawner.ChildProcessSpawner> {
  const cmd = argv[0]
  const command = toCommand(argv, opts)
  const run = Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const handle = yield* spawner.spawn(command)
    const code = handle.exitCode.pipe(
      Effect.map(Number),
      Effect.catch((e) => Effect.succeed(signalCode(e))),
    )
    return yield* Effect.all([text(handle.stdout), text(handle.stderr), code], { concurrency: 3 })
  })
  return Effect.scoped(Effect.timeoutOption(run, opts.timeoutMs)).pipe(
    Effect.map(
      Option.match({
        onNone: () => ({ code: SIGTERM_CODE, stdout: '', stderr: '', timedOut: true }),
        onSome: ([stdout, stderr, code]) => ({ code, stdout, stderr, timedOut: false }),
      }),
    ),
    Effect.mapError((err) => new ProcError({ message: `${cmd}: ${errMsg(err)}` })),
  )
}
