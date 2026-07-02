// FOSS browser-automation adapter: drives the agent-browser CLI (vercel-labs,
// native Rust) via its JSON stdin batch mode. Commands are structured argv
// arrays (e.g. ['open', url]) — values stay atomic, so no argument injection.
// Bin resolution is package-rooted, not cwd-rooted, so global installs work
// from any directory.
import { runProc } from '../core/proc.ts'
import { resolveBin } from '../core/root.ts'

interface BatchResult {
  stdout: string
  stderr: string
  code: number
}

export function available(): boolean {
  return resolveBin('agent-browser') !== null
}

export async function runBatch(commands: string[][]): Promise<BatchResult> {
  const bin = resolveBin('agent-browser')
  if (!bin)
    return { stdout: '', stderr: 'agent-browser unavailable — reinstall webular', code: 127 }
  const { stdout, stderr, code } = await runProc([bin, 'batch', '--bail'], {
    timeoutMs: 60_000,
    stdin: JSON.stringify(commands),
  })
  return { stdout, stderr, code }
}
