// Shared command runner: execute a Mastra workflow and emit/report its result.
// Deterministic runId (= command name: unique per process, stable across
// runs), per-command human rendering, uniform exit codes, and a stderr note
// when a payload carries partial-failure errors.
import type { AnyWorkflow } from '@mastra/core/workflows'
import { Effect, type FileSystem, type Path } from 'effect'
import type { EventFromLogic } from 'xstate'
import { CliError } from '../core/effect.ts'
import { emit, errMsg, logErr, type OutputError } from '../core/output.ts'
import { outPath, type SandboxError } from '../core/safepath.ts'
import { normalizeUrl } from '../core/url.ts'
import { commandLifecycleMachine } from '../machines/command-lifecycle.ts'
import { EXIT, payloadExit, settledExit } from './exit-codes.ts'
import { renderFor } from './render.ts'
import { safeText } from './style.ts'

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
    return payloadExit(empty, errorCount(result))
  }
}

type LifecycleEvent = EventFromLogic<typeof commandLifecycleMachine>

// Every exit below comes from the command-lifecycle machine's final state.
// Failure lines say what went wrong, then what to try next. The detail may
// quote web text, so it is escaped before it reaches a terminal.
const failed = (name: string, detail: string, events: LifecycleEvent[]) =>
  Effect.as(
    logErr(
      `${name}: failed (${safeText(detail)})\nCheck the input, then try again. Run 'webular doctor' to check your setup.`,
    ),
    settledExit(commandLifecycleMachine, events),
  )

function rendered(failures: number, policy: number): LifecycleEvent {
  if (policy === EXIT.partial) return { type: 'PARTIAL' }
  if (policy !== EXIT.ok) return { type: 'EMPTY_WITH_ERRORS' }
  return failures > 0 ? { type: 'SOME_ERRORS' } : { type: 'NO_ERRORS' }
}

function report(
  name: string,
  outcome: Outcome,
  opts: RunOpts,
): Effect.Effect<number, OutputError | SandboxError, FileSystem.FileSystem | Path.Path> {
  if (outcome.status !== 'success')
    return failed(name, outcome.status === 'failed' ? outcome.error.message : outcome.status, [
      { type: 'INPUT_VALID' },
      { type: 'WORKFLOW_FAILED' },
    ])
  const failures = errorCount(outcome.result)
  const { exitCode, ...emitOpts } = opts
  const exit = settledExit(commandLifecycleMachine, [
    { type: 'INPUT_VALID' },
    { type: 'WORKFLOW_SUCCEEDED' },
    rendered(failures, exitCode?.(outcome.result) ?? EXIT.ok),
  ])
  const note =
    failures > 0
      ? logErr(
          `${name}: ${failures} fetch${failures === 1 ? '' : 'es'} failed. Run again with --json to see each error.`,
        )
      : Effect.void
  return note.pipe(
    Effect.andThen(emit(outcome.result, { ...emitOpts, render: renderFor(name) })),
    Effect.as(exit),
  )
}

// A url that is not a full http or https address is wrong usage (exit 2), so
// it fails before the workflow loads.
const checkUrl = (name: string, inputData: unknown): Effect.Effect<void, CliError> => {
  const url = (inputData as { url?: unknown } | null)?.url
  if (typeof url !== 'string') return Effect.void
  const href = normalizeUrl(url)
  const protocol = href === null ? '' : new URL(href).protocol
  if (protocol === 'http:' || protocol === 'https:') return Effect.void
  const message = `${name}: '${safeText(url)}' is not a web address. Use a full http or https URL, such as https://example.com.`
  return Effect.fail(new CliError({ message, exitCode: EXIT.usage }))
}

const startRun = (inputData: unknown) => (created: WorkflowRun) =>
  Effect.tryPromise({ try: () => created.start({ inputData }), catch: errMsg })

// The run ends by stopping the parse pool's idle workers. The shared step
// runtime stays usable for the next run in this process. The module is cached:
// the workflow loaded it.
const disposeSteps = Effect.promise(() => import('../workflows/runtime.ts')).pipe(
  Effect.flatMap((m) => m.drainParsePool),
  Effect.ignore,
)

// The Mastra run is the Promise edge; it surfaces input-validation failures by
// rejecting from start, which reports as a plain failure (exit 1). The
// workflow loads lazily: importing @mastra/core costs seconds of disk reads,
// so flag errors fail before it loads. The loader resolves to the module, never
// the workflow: a Mastra workflow has a builder .then, so a Promise resolving to
// it adopts it as a thenable and never settles. The logger loads with it: a
// silent logger keeps the step's stack trace off stderr, and the failure line
// still names the cause.
// A bad -o path fails before the workflow module loads and the page is fetched.
export function runWorkflow<M>(
  name: string,
  load: () => Promise<M>,
  pick: (mod: M) => AnyWorkflow,
  inputData: unknown,
  opts: RunOpts,
): Effect.Effect<number, CliError | OutputError | SandboxError, FileSystem.FileSystem | Path.Path> {
  const run = Effect.tryPromise({
    try: () => Promise.all([load(), import('@mastra/core/logger')]),
    catch: errMsg,
  }).pipe(
    Effect.flatMap(([mod, { noopLogger }]) =>
      Effect.tryPromise({
        try: () => {
          const workflow = pick(mod)
          workflow.__setLogger(noopLogger)
          return workflow.createRun({ runId: name })
        },
        catch: errMsg,
      }),
    ),
    Effect.flatMap((created) => startRun(inputData)(created).pipe(Effect.ensuring(disposeSteps))),
    Effect.matchEffect({
      onFailure: (detail) => failed(name, detail, [{ type: 'INPUT_INVALID' }]),
      onSuccess: (outcome) => report(name, outcome, opts),
    }),
  )
  const checkOut = opts.output ? Effect.asVoid(outPath(opts.output)) : Effect.void
  return checkUrl(name, inputData).pipe(Effect.andThen(checkOut), Effect.andThen(run))
}
