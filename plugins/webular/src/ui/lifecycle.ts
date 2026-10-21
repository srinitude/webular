// What every view shows, derived from the CLI's command lifecycle machine:
// a plain label per state, the three-step strip, the moves the machine allows
// next, the events a tool result sends, and the same data as text.
import type { EventFrom, SnapshotFrom } from 'xstate'
import { commandLifecycleMachine } from '../../../../src/machines/command-lifecycle.ts'
import type { FetchError } from './views.ts'

type Lifecycle = typeof commandLifecycleMachine
type LifecycleEvent = EventFrom<Lifecycle>

export const stateLabels: Record<string, string> = {
  validatingInput: 'Checking the input',
  runningWorkflow: 'Reading the web',
  rendering: 'Putting the results together',
  completed: 'Done',
  completedWithPartialFailures: 'Done, some failed',
  emptyWithErrors: 'No results',
  partial: 'Done, some pages failed',
  rejected: 'Input rejected',
  failed: 'Run failed',
}

// The strip's three steps, one per non-final machine state: the label while
// the step runs, then the label once it is done.
export const steps = [
  ['validatingInput', 'Checking input', 'Input checked'],
  ['runningWorkflow', 'Fetching pages', 'Pages fetched'],
  ['rendering', 'Writing results', 'Results written'],
] as const

// What each allowed move means to a person; the system fires every event, so
// the view shows these as plain text, never as buttons.
export const moveLabels: Record<LifecycleEvent['type'], string> = {
  INPUT_VALID: 'the run starts',
  INPUT_INVALID: 'the input is rejected',
  WORKFLOW_SUCCEEDED: 'the results are put together',
  WORKFLOW_FAILED: 'the run fails',
  NO_ERRORS: 'every source is read',
  SOME_ERRORS: 'some sources fail',
  EMPTY_WITH_ERRORS: 'no source can be read',
  PARTIAL: 'some named pages fail',
}

const eventTypes = commandLifecycleMachine.root.events as LifecycleEvent['type'][]

// ponytail: computed from snapshot.can; swap to machine.next when the Stately agent lands.
export const nextMoves = (snapshot: SnapshotFrom<Lifecycle>) =>
  eventTypes.filter((type) => snapshot.can({ type }))

export interface SessionResult {
  readonly topic?: string
  readonly query?: string
  readonly url?: string
  readonly root?: string
  readonly report?: string
  readonly answer?: string
  readonly sources?: ReadonlyArray<{ readonly title: string; readonly url: string }>
  readonly links?: ReadonlyArray<string>
  readonly pages?: ReadonlyArray<{ readonly title: string; readonly url: string }>
  readonly changeStatus?: 'new' | 'same' | 'changed'
  readonly diff?: string
  readonly errors?: ReadonlyArray<FetchError>
  readonly error?: true
  readonly message?: string
}

export const coverage = (result: SessionResult) => {
  const failed = result.errors?.length ?? 0
  const found =
    (result.sources?.length ?? 0) + (result.links?.length ?? 0) + (result.pages?.length ?? 0)
  return { found, failed, words: `${found} of ${found + failed} read, ${failed} failed` }
}

// Bad input says so in its message: the server's exit-2 wording, or Mastra's schema check.
const badInput = /Fix the input|input validation failed/i

// A rejected input stops before the run; otherwise the input passed and the
// workflow ran, and the discovery exit rule (src/cli/run.ts) splits clean,
// partial, and empty-with-errors.
export const resultEvents = (result: SessionResult): LifecycleEvent[] => {
  if (result.error && badInput.test(result.message ?? '')) return [{ type: 'INPUT_INVALID' }]
  if (result.error) return [{ type: 'INPUT_VALID' }, { type: 'WORKFLOW_FAILED' }]
  const { found, failed } = coverage(result)
  const end = failed === 0 ? 'NO_ERRORS' : found > 0 ? 'SOME_ERRORS' : 'EMPTY_WITH_ERRORS'
  return [{ type: 'INPUT_VALID' }, { type: 'WORKFLOW_SUCCEEDED' }, { type: end }]
}

// Copy as text: the agent's header line, then the same JSON the agent got.
export const asText = (snapshot: SnapshotFrom<Lifecycle>, result: SessionResult) => {
  const { found, failed, words } = coverage(result)
  const label = stateLabels[String(snapshot.value)]
  const header = found + failed > 0 ? `${label} (${words})` : label
  return `${header}\n${JSON.stringify(result, null, 2)}`
}
