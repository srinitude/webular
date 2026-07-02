// Shared command runner: execute a Mastra workflow and emit/report its result.
// Deterministic runId (= command name: unique per process, stable across
// runs), per-command human rendering, uniform exit codes, and a stderr note
// when a payload carries partial-failure errors.
import type { AnyWorkflow } from '@mastra/core/workflows'
import { emit, errMsg, logErr } from '../core/output.ts'
import { renderFor } from './render.ts'

interface RunOpts {
  json?: boolean
  output?: string
  exitCode?: (result: unknown) => number
}

function errorCount(result: unknown): number {
  if (!result || typeof result !== 'object') return 0
  const errors = (result as { errors?: unknown }).errors
  return Array.isArray(errors) ? errors.length : 0
}

// Discovery commands (crawl/map/answer/research) share ONE policy: partial
// failures ride in the payload (exit 0 + stderr note); exit 1 only when the
// primary payload is empty AND errors exist.
export function discoveryExit(field: string): (result: unknown) => number {
  return (result) => {
    const r = result as Record<string, unknown>
    const payload = r[field]
    const empty = Array.isArray(payload) ? payload.length === 0 : !payload
    return empty && errorCount(result) > 0 ? 1 : 0
  }
}

export async function runWorkflow(
  name: string,
  workflow: AnyWorkflow,
  inputData: unknown,
  opts: RunOpts,
): Promise<number> {
  const run = await workflow.createRun({ runId: name })
  let outcome: Awaited<ReturnType<typeof run.start>>
  try {
    // Mastra surfaces input-validation failures by throwing from start.
    outcome = await run.start({ inputData })
  } catch (err) {
    logErr(`${name}: failed (${errMsg(err)})`)
    return 1
  }
  if (outcome.status !== 'success') {
    const detail = outcome.status === 'failed' ? outcome.error.message : outcome.status
    logErr(`${name}: failed (${detail})`)
    return 1
  }
  const failures = errorCount(outcome.result)
  if (failures > 0) logErr(`${name}: ${failures} fetch${failures === 1 ? '' : 'es'} failed`)
  await emit(outcome.result, { json: opts.json, output: opts.output, render: renderFor(name) })
  return opts.exitCode?.(outcome.result) ?? 0
}
