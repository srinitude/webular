// FOSS browser-automation adapter: drives the agent-browser CLI (vercel-labs,
// native Rust) via its JSON stdin batch mode. Commands are structured argv
// arrays (e.g. ['open', url]) — values stay atomic, so no argument injection.
import { existsSync } from 'node:fs'

export interface BatchResult {
  stdout: string
  stderr: string
  code: number
}

function binPath(): string {
  return Bun.which('agent-browser') ?? `${process.cwd()}/node_modules/.bin/agent-browser`
}

export function available(): boolean {
  return (
    Bun.which('agent-browser') !== null ||
    existsSync(`${process.cwd()}/node_modules/.bin/agent-browser`)
  )
}

export async function runBatch(commands: string[][]): Promise<BatchResult> {
  const proc = Bun.spawn([binPath(), 'batch', '--bail'], {
    stdin: new TextEncoder().encode(JSON.stringify(commands)),
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 60_000,
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { stdout, stderr, code }
}
