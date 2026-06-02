// Shared command runner: execute a Mastra workflow and emit/report its result.
// Keeps every command entry tiny and consistent (clig.dev exit codes).
import { emit, logErr } from '../core/output.ts'

type Runnable = {
  createRun(options: { runId: string }): Promise<{
    start(args: {
      inputData: unknown
    }): Promise<{ status: string; result?: unknown; error?: unknown }>
  }>
}

export async function runWorkflow(
  name: string,
  workflow: unknown,
  inputData: unknown,
  opts: { json?: boolean; output?: string },
): Promise<number> {
  const run = await (workflow as Runnable).createRun({ runId: crypto.randomUUID() })
  const outcome = await run.start({ inputData })
  if (outcome.status !== 'success') {
    logErr(`${name}: failed (${String(outcome.error ?? outcome.status)})`)
    return 1
  }
  await emit(outcome.result, opts)
  return 0
}
