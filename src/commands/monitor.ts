// MONITOR command entry — invoked by `mise run run:monitor`. Parses flags,
// runs the Mastra monitor workflow, emits the result. No mise logic here.
import { createHash } from 'node:crypto'
import { mkdirSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags, timeoutFlag } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { outPath, sandboxEnabled } from '../core/safepath.ts'
import { monitorWorkflow } from '../workflows/monitor.ts'

// Per-user, per-project default (keyed by realpath of the INVOKING directory —
// the gateway pins process cwd to the package root). A tmpdir default would
// share one single-writer sqlite file across every user on the host.
function defaultDbPath(): string {
  const stateHome = process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state')
  const project = realpathSync(process.env.WEBULAR_INVOKE_DIR ?? process.cwd())
  const key = createHash('sha256').update(project).digest('hex').slice(0, 12)
  const dir = join(stateHome, 'webular')
  mkdirSync(dir, { recursive: true })
  return join(dir, `monitor-${key}.db`)
}

function resolveDbPath(flagValue: unknown): string {
  if (typeof flagValue === 'string' && flagValue.length > 0) return flagValue
  if (process.env.WEBULAR_DB) return process.env.WEBULAR_DB
  if (sandboxEnabled()) return 'webular-monitor.db'
  return defaultDbPath()
}

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    db: { type: 'string' },
  })
  const url = (values.url as string) ?? positionals[0]
  if (!url) {
    logErr('monitor: missing <url> (pass --url <url> or a positional URL)')
    return 2
  }
  const inputData = {
    url,
    dbPath: outPath(resolveDbPath(values.db)),
    timeoutMs: timeoutFlag('monitor', values),
  }
  return runWorkflow('monitor', monitorWorkflow, inputData, emitOpts(values))
}

process.exit(await main())
