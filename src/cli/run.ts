// Shared command runner: execute a Mastra workflow and emit/report its result.
// Deterministic runId (= command name: unique per process, stable across
// runs), per-command human rendering, uniform exit codes, and a stderr note
// when a payload carries partial-failure errors.
import type { AnyWorkflow } from '@mastra/core/workflows'
import { Effect, type FileSystem, type Path } from 'effect'
import { emit, errMsg, logErr, type OutputError } from '../core/output.ts'
import type { SandboxError } from '../core/safepath.ts'
import { renderFor } from './render.ts'

interface RunOpts {
  json?: boolean | undefined
  ndjson?: boolean | undefined
  fields?: string[] | undefined
  output?: string | undefined
  exitCode?: (result: unknown) => number
}

type WorkflowRun = Awaited<ReturnType<AnyWorkflow['createRun']>>
type Outcome = Awaited<ReturnType<WorkflowRun['start']>>

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

const failed = (name: string, detail: string) => Effect.as(logErr(`${name}: failed (${detail})`), 1)

function report(
  name: string,
  outcome: Outcome,
  opts: RunOpts,
): Effect.Effect<number, OutputError | SandboxError, FileSystem.FileSystem | Path.Path> {
  if (outcome.status !== 'success')
    return failed(name, outcome.status === 'failed' ? outcome.error.message : outcome.status)
  const failures = errorCount(outcome.result)
  const note =
    failures > 0
      ? logErr(`${name}: ${failures} fetch${failures === 1 ? '' : 'es'} failed`)
      : Effect.void
  const { exitCode, ...emitOpts } = opts
  return note.pipe(
    Effect.andThen(emit(outcome.result, { ...emitOpts, render: renderFor(name) })),
    Effect.as(exitCode?.(outcome.result) ?? 0),
  )
}

// The Mastra run is the Promise edge; it surfaces input-validation failures by
// rejecting from start, which reports as a plain failure (exit 1). The
// workflow loads lazily: importing @mastra/core costs seconds of disk reads,
// so flag errors fail before it loads. The loader resolves to the module, never
// the workflow: a Mastra workflow has a builder .then, so a Promise resolving to
// it adopts it as a thenable and never settles.
export function runWorkflow<M>(
  name: string,
  load: () => Promise<M>,
  pick: (mod: M) => AnyWorkflow,
  inputData: unknown,
  opts: RunOpts,
): Effect.Effect<number, OutputError | SandboxError, FileSystem.FileSystem | Path.Path> {
  return Effect.tryPromise({
    try: () => load().then((mod) => pick(mod).createRun({ runId: name })),
    catch: errMsg,
  }).pipe(
    Effect.flatMap((run) =>
      Effect.tryPromise({ try: () => run.start({ inputData }), catch: errMsg }),
    ),
    Effect.matchEffect({
      onFailure: (detail) => failed(name, detail),
      onSuccess: (outcome) => report(name, outcome, opts),
    }),
  )
}
