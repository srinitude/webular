// Shared subprocess runner: argv arrays only (no shell), mandatory timeout,
// and CONCURRENT stdout/stderr draining — a child that fills one pipe past
// 64KB while the parent awaits the other deadlocks, so both drain together.
import { availableParallelism, constants } from 'node:os'
import { Context, Data, Effect, Option, Semaphore, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { errMsg } from './output.ts'

export class ProcError extends Data.TaggedError('ProcError')<{ readonly message: string }> {}

interface ProcResult {
  code: number
  stdout: string
  stderr: string
  timedOut: boolean
  // True when a stream hit MAX_OUTPUT_BYTES: the child was killed, its output cut.
  truncated: boolean
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

// Bytes kept per stream; a chattier child is killed, not buffered further.
export const MAX_OUTPUT_BYTES = 16 * 1024 * 1024
// SIGTERM, then SIGKILL after this long: the grace src/cli/dispatch.ts gives its children.
const KILL_GRACE = '5 seconds'

// One permit per live child, shared by every runProc call unless a test
// provides its own; sized to the CPUs so parallel callers queue, not fork-bomb.
export const ProcPermits = Context.Reference<Semaphore.Semaphore>('webular/core/ProcPermits', {
  defaultValue: () => Semaphore.makeUnsafe(availableParallelism()),
})

// The spawner fails exitCode for a child killed by a signal; report the shell
// convention 128 + signal number instead, like any other non-zero exit.
const signalCode = (err: unknown): number => {
  const name = /'(SIG[A-Z0-9]+)'/.exec(errMsg(err))?.[1] as keyof typeof constants.signals
  return 128 + (constants.signals[name] ?? 0)
}

// Keeps at most MAX_OUTPUT_BYTES, stops reading at the first byte past it, then
// runs onOverflow (the kill), so a child cannot grow our memory or stall on a full pipe.
const capped = <E>(s: Stream.Stream<Uint8Array, E>, onOverflow: Effect.Effect<void>) =>
  s.pipe(
    Stream.mapAccum(
      () => 0,
      (n, c: Uint8Array) => [
        n + c.length,
        [
          {
            c: c.subarray(0, Math.max(0, MAX_OUTPUT_BYTES - n)),
            over: n + c.length > MAX_OUTPUT_BYTES,
          },
        ],
      ],
    ),
    Stream.takeUntil((x) => x.over),
    Stream.runFold(
      () => ({ chunks: [] as Uint8Array[], over: false }),
      (acc, x) => {
        acc.chunks.push(x.c)
        acc.over = x.over
        return acc
      },
    ),
    Effect.tap((r) => (r.over ? onOverflow : Effect.void)),
    Effect.map((r) => ({ text: Buffer.concat(r.chunks).toString(), over: r.over })),
  )

// detached: true makes the child lead its own process group, so a timeout,
// interrupt, or overflow kill signals the whole tree and leaves no orphaned
// grandchild. Ctrl-C reaches it through our interrupt, which runs that kill.
const toCommand = ([cmd, ...args]: [string, ...string[]], opts: ProcOptions) =>
  ChildProcess.make(cmd, args, {
    cwd: opts.cwd,
    env: opts.env,
    extendEnv: opts.extendEnv,
    detached: true,
    stdin: opts.stdin === undefined ? 'ignore' : Stream.make(new TextEncoder().encode(opts.stdin)),
  })

// A timeout or interruption kills a child still running: SIGTERM, then SIGKILL
// after KILL_GRACE for one that ignores it.
const drain = (command: ReturnType<typeof toCommand>) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const handle = yield* spawner.spawn(command)
    const kill = handle.kill({ forceKillAfter: KILL_GRACE }).pipe(Effect.ignore)
    const code = handle.exitCode.pipe(
      Effect.map(Number),
      Effect.catch((e) => Effect.succeed(signalCode(e))),
    )
    return yield* Effect.all([capped(handle.stdout, kill), capped(handle.stderr, kill), code], {
      concurrency: 3,
    }).pipe(Effect.onInterrupt(() => kill))
  })

// Holds a permit for the child's whole life. It wraps the timeout, so time
// spent queued for a permit never counts against the child's own deadline.
const permitted = <A, E, R>(eff: Effect.Effect<A, E, R>) =>
  Effect.flatMap(ProcPermits, (p) => p.withPermits(1)(eff))

export function runProc(
  argv: [string, ...string[]],
  opts: ProcOptions,
): Effect.Effect<ProcResult, ProcError, ChildProcessSpawner.ChildProcessSpawner> {
  const cmd = argv[0]
  const run = drain(toCommand(argv, opts))
  return permitted(Effect.scoped(Effect.timeoutOption(run, opts.timeoutMs))).pipe(
    Effect.map(
      Option.match({
        onNone: () => ({
          code: SIGTERM_CODE,
          stdout: '',
          stderr: '',
          timedOut: true,
          truncated: false,
        }),
        onSome: ([out, err, code]) => ({
          code,
          stdout: out.text,
          stderr: err.text,
          timedOut: false,
          truncated: out.over || err.over,
        }),
      }),
    ),
    Effect.mapError((err) => new ProcError({ message: `${cmd}: ${errMsg(err)}` })),
  )
}
