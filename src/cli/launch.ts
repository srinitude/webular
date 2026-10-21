// Launcher policy, one rung at a time: the native webular build for this OS
// and CPU, else Bun running the dist bundle, else Bun running src. A wrong or
// corrupt binary never runs (platform.ts checks its header first), and a
// binary that cannot start falls through with one stderr line.
import { join, sep } from 'node:path'
import { Config, Effect, FileSystem, Option } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { logErr } from '../core/output.ts'
import { hostFacts, nativeExecutable, targetFor } from '../core/platform.ts'
import { PACKAGE_ROOT } from '../core/root.ts'

const NO_ENV: Record<string, string> = {}
const env = (name: string) => Config.String(name).pipe(Config.withDefault(''))

// Failures that mean "this build cannot run here": the spawn itself failed, or
// the process died on an illegal instruction or system call before command
// work started, so a Bun retry repeats no side effect. Windows reports these
// as STATUS_ILLEGAL_INSTRUCTION / STATUS_DLL_NOT_FOUND exit codes.
const WINDOWS_CANNOT_START = new Set([3221225501, 3221225781])
const SIGNAL_CANNOT_START = /SIGILL|SIGSYS/

const runNative = (path: string, argv: string[]) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const cmd = ChildProcess.make(path, argv, {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    })
    const handle = yield* spawner.spawn(cmd).pipe(Effect.option)
    if (Option.isNone(handle)) return Option.none<number>()
    const code = yield* handle.value.exitCode.pipe(
      Effect.map(Number),
      Effect.catch((err) => Effect.succeed(SIGNAL_CANNOT_START.test(String(err)) ? -1 : 1)),
    )
    return code === -1 || WINDOWS_CANNOT_START.has(code) ? Option.none<number>() : Option.some(code)
  }).pipe(Effect.scoped)

const installed = PACKAGE_ROOT.split(sep).includes('node_modules')

// Some(exit code) when a native build ran; None means "run under Bun".
export const launchNative = (argv: string[]) =>
  Effect.gen(function* () {
    const off = (yield* env('WEBULAR_NATIVE')) === '0'
    if (Bun.isStandaloneExecutable || off) return Option.none<number>()
    const facts = yield* hostFacts
    const key = targetFor(facts)?.key ?? `${facts.platform}-${facts.arch}`
    const exe = yield* nativeExecutable(PACKAGE_ROOT, facts)
    const code = Option.isSome(exe) ? yield* runNative(exe.value, argv) : Option.none<number>()
    if (Option.isNone(code) && (installed || Option.isSome(exe))) {
      logErr(`webular: no runnable native build for ${key}; running with Bun instead.`)
    }
    return code
  })

// Bun rung: the dist bundle when it was built, else src. Returns the extra
// task env (WEBULAR_DEV, which mise.toml reads) for the gateway to pass on.
export const bunEntryEnv = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const built = yield* fs.exists(join(PACKAGE_ROOT, 'dist', 'commands', 'search.js'))
  if (built || (yield* env('WEBULAR_DEV')) !== '') return NO_ENV
  logErr('webular: no dist bundle found; running commands from src.')
  return { ...NO_ENV, WEBULAR_DEV: '1' }
}).pipe(Effect.orElseSucceed(() => NO_ENV))
