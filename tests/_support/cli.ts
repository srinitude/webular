// One spawn helper for every command test — stdout/stderr drain CONCURRENTLY
// (sequential drains deadlock once a pipe passes 64KB; see src/core/proc.ts).
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

export async function runCli(
  entry: string,
  args: string[],
  opts: CliOptions = {},
): Promise<CliResult> {
  const proc = Bun.spawn([opts.exec ?? 'bun', `${ROOT}${entry}`, ...args], {
    cwd: opts.cwd ?? ROOT,
    env: opts.env ?? { ...process.env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { code, out, err }
}
