// MONITOR command entry — invoked by `mise run run:monitor`. Parses flags,
// runs the Mastra monitor workflow, emits the result. No mise logic here.
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { safePath, sandboxEnabled } from '../core/safepath.ts'
import { monitorWorkflow } from '../workflows/monitor.ts'

interface WorkflowOutcome {
  status: string
  result?: unknown
  error?: unknown
}

function resolveDbPath(flagValue: unknown): string {
  if (typeof flagValue === 'string' && flagValue.length > 0) return flagValue
  if (process.env.WEBULAR_DB) return process.env.WEBULAR_DB
  if (sandboxEnabled()) return 'webular-monitor.db'
  return join(tmpdir(), 'webular-monitor.db')
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
  const dbPath = safePath(resolveDbPath(values.db))
  const run = await monitorWorkflow.createRun({ runId: crypto.randomUUID() })
  const outcome = (await run.start({ inputData: { url, dbPath } })) as WorkflowOutcome
  if (outcome.status !== 'success') {
    logErr(`monitor: failed (${String(outcome.error ?? outcome.status)})`)
    return 1
  }
  await emit(outcome.result, {
    json: Boolean(values.json),
    output: values.output as string | undefined,
  })
  return 0
}

process.exit(await main())
