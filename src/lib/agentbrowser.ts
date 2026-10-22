// FOSS browser-automation adapter: drives the agent-browser CLI (vercel-labs,
// native Rust) via its JSON stdin batch mode. Commands are structured argv
// arrays (e.g. ['open', url]) — values stay atomic, so no argument injection.
// Bin resolution is package-rooted, not cwd-rooted, so global installs work
// from any directory.
import { dirname, join } from 'node:path'
import { Effect, type Path } from 'effect'
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

/** The native agent-browser binary next to the package, else the shim on PATH. */
export const agentBin = Effect.fn('agentBin')(function* () {
  const direct = native
    ? yield* Effect.try(() => Bun.resolveSync('agent-browser/package.json', import.meta.dir)).pipe(
        Effect.map((pkg) => Bun.which(native, { PATH: join(dirname(pkg), 'bin') })),
        Effect.orElseSucceed(() => null),
      )
    : null
  return direct ?? (yield* resolveBin('agent-browser'))
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
