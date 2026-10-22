// FOSS browser-automation adapter: drives the agent-browser CLI (vercel-labs,
// native Rust) via its JSON stdin batch mode. Commands are structured argv
// arrays (e.g. ['open', url]) — values stay atomic, so no argument injection.
// Bin resolution is package-rooted, not cwd-rooted, so global installs work
// from any directory.
import { Effect, type Path } from 'effect'
import { runProc } from '../core/proc.ts'
import { resolveBin } from '../core/root.ts'

export const available = (): Effect.Effect<boolean, never, Path.Path> =>
  Effect.map(resolveBin('agent-browser'), (bin) => bin !== null)

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
  const bin = yield* resolveBin('agent-browser')
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
