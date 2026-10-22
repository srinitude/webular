// FOSS browser-automation adapter: drives the agent-browser CLI (vercel-labs,
// native Rust) via its JSON stdin batch mode. Commands are structured argv
// arrays (e.g. ['open', url]) — values stay atomic, so no argument injection.
// Bin resolution is package-rooted, not cwd-rooted, so global installs work
// from any directory.
import { dirname, join } from 'node:path'
import { Context, Effect, FileSystem, type Path } from 'effect'
import { runProc } from '../core/proc.ts'
import { resolveBin } from '../core/root.ts'

export const available = (): Effect.Effect<boolean, never, Path.Path> =>
  Effect.map(resolveBin('agent-browser'), (bin) => bin !== null)

// The `agent-browser` shim is a node script that starts node, then spawns the
// native binary: about 250 ms per batch. The package's own native binary for
// this platform skips that, so every capture spawns it directly. The package
// ships no win32-arm64 build: its own launcher runs the x64 one through
// Windows' emulation, and so does this.
// ponytail: Linux keeps the shim, which tells glibc from musl; resolve the musl
// build here too if Linux capture latency matters.
export const nativeName = (platform: string, arch: string) =>
  platform === 'linux'
    ? null
    : platform === 'win32'
      ? `agent-browser-win32-${arch === 'arm64' ? 'x64' : arch}.exe`
      : `agent-browser-${platform}-${arch}`

// Package launchers: the node script on Unix, npm's .cmd/.ps1/.bat wrappers on
// Windows, and bun's .exe launcher, which stays in node_modules/.bin.
const SHIM = /\.(js|cmd|ps1|bat)$|[\\/]node_modules[\\/]\.bin[\\/]/i

const packageBinDir = Effect.try(() =>
  join(dirname(Bun.resolveSync('agent-browser/package.json', import.meta.dir)), 'bin'),
).pipe(Effect.orElseSucceed(() => null))

/**
 * A real `agent-browser` executable on PATH (an override or a test stub) wins.
 * When PATH holds only a launcher, spawn the package's native binary instead.
 */
export const pickBin = Effect.fn('pickBin')(function* (
  bin: string | null,
  native: string | null,
  binDir?: string,
) {
  const fs = yield* FileSystem.FileSystem
  const real = bin ? yield* fs.realPath(bin).pipe(Effect.orElseSucceed(() => bin)) : null
  if (!native || (real && !SHIM.test(real))) return bin
  const dir = binDir ?? (yield* packageBinDir)
  return (dir ? Bun.which(native, { PATH: dir }) : null) ?? bin
})

export const agentBin = Effect.fn('agentBin')(function* () {
  const bin = yield* resolveBin('agent-browser')
  return yield* pickBin(bin, nativeName(process.platform, process.arch))
})

// A named session keeps its browser warm between batches of one run. Every
// batch names a webular session, never agent-browser's `default`, which has no
// idle timeout and so outlived every run that opened it. The run's end closes
// each session it opened (closeSessions); the daemon's idle timeout backs that
// up if the process dies first. The variable goes through the spawn env, not
// /usr/bin/env, which Windows lacks.
const IDLE_MS = 120_000

// The sessions opened since the last closeSessions, shared like ProcPermits.
// ponytail: one set per process; two runs at once in one process (the MCP
// server) close each other's warm sessions early: a cold start, never a leak.
const OpenSessions = Context.Reference<Set<string>>('webular/lib/OpenSessions', {
  defaultValue: () => new Set(),
})

export const runBatch = Effect.fn('runBatch')(function* (
  commands: string[][],
  session = 'webular',
  timeoutMs = 60_000,
) {
  const bin = yield* agentBin()
  if (!bin)
    return { stdout: '', stderr: 'agent-browser unavailable — reinstall webular', code: 127 }
  ;(yield* OpenSessions).add(session)
  const { stdout, stderr, code } = yield* runProc([bin, '--session', session, 'batch', '--bail'], {
    timeoutMs,
    stdin: JSON.stringify(commands),
    env: { AGENT_BROWSER_IDLE_TIMEOUT_MS: String(IDLE_MS) },
    extendEnv: true,
  })
  return { stdout, stderr, code }
})

// Closes every session opened since the last call, so no browser outlives the
// run, command, or test that started it.
export const closeSessions = Effect.gen(function* () {
  const open = yield* OpenSessions
  yield* Effect.forEach(
    [...open],
    (session) =>
      runBatch([['close']], session, 15_000).pipe(
        Effect.ignore,
        Effect.ensuring(Effect.sync(() => open.delete(session))),
      ),
    { concurrency: 4, discard: true },
  )
})
