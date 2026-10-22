// FOSS browser-automation adapter: drives the agent-browser CLI (vercel-labs,
// native Rust) via its JSON stdin batch mode. Commands are structured argv
// arrays (e.g. ['open', url]) — values stay atomic, so no argument injection.
// Bin resolution is package-rooted, not cwd-rooted, so global installs work
// from any directory.
import { dirname, join } from 'node:path'
import { Effect, FileSystem, type Path } from 'effect'
import { runProc } from '../core/proc.ts'
import { resolveBin } from '../core/root.ts'

export const available = (): Effect.Effect<boolean, never, Path.Path> =>
  Effect.map(resolveBin('agent-browser'), (bin) => bin !== null)

// The `agent-browser` shim is a node script that starts node, then spawns the
// native binary: about 250 ms per batch. The package's own native binary for
// this platform skips that, so every capture spawns it directly.
// ponytail: Linux keeps the shim, which tells glibc from musl; resolve the musl
// build here too if Linux capture latency matters.
const native =
  process.platform === 'linux'
    ? null
    : `agent-browser-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`

// Package launchers: the node script on Unix, npm's .cmd/.ps1/.bat wrappers on
// Windows, and bun's .exe launcher, which stays in node_modules/.bin.
const SHIM = /\.(js|cmd|ps1|bat)$|[\\/]node_modules[\\/]\.bin[\\/]/i

/**
 * A real `agent-browser` executable on PATH (an override or a test stub) wins.
 * When PATH holds only the node shim, spawn the package's native binary instead.
 */
export const agentBin = Effect.fn('agentBin')(function* () {
  const bin = yield* resolveBin('agent-browser')
  const fs = yield* FileSystem.FileSystem
  const real = bin ? yield* fs.realPath(bin).pipe(Effect.orElseSucceed(() => bin)) : null
  if (!native || (real && !SHIM.test(real))) return bin
  const direct = yield* Effect.try(() =>
    Bun.resolveSync('agent-browser/package.json', import.meta.dir),
  ).pipe(
    Effect.map((pkg) => Bun.which(native, { PATH: join(dirname(pkg), 'bin') })),
    Effect.orElseSucceed(() => null),
  )
  return direct ?? bin
})

// A named session keeps its browser warm between batches; its daemon shuts
// itself down after IDLE_MS with no command, so nothing outlives the work.
// The variable goes through the spawn env, not /usr/bin/env, which Windows lacks.
const IDLE_MS = 120_000
const sessionArgs = (session?: string) => (session ? ['--session', session] : [])
const sessionEnv = (session?: string) =>
  session ? { env: { AGENT_BROWSER_IDLE_TIMEOUT_MS: String(IDLE_MS) }, extendEnv: true } : {}

export const runBatch = Effect.fn('runBatch')(function* (
  commands: string[][],
  session?: string,
  timeoutMs = 60_000,
) {
  const bin = yield* agentBin()
  if (!bin)
    return { stdout: '', stderr: 'agent-browser unavailable — reinstall webular', code: 127 }
  const { stdout, stderr, code } = yield* runProc(
    [bin, ...sessionArgs(session), 'batch', '--bail'],
    {
      timeoutMs,
      stdin: JSON.stringify(commands),
      ...sessionEnv(session),
    },
  )
  return { stdout, stderr, code }
})
