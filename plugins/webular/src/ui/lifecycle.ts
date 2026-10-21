// What the session view shows, derived from the CLI's command lifecycle machine:
// a plain label per state, the moves the machine allows next, and the events a
// tool result sends. Pure functions, so the view and the tests share them.
import type { EventFrom, SnapshotFrom } from 'xstate'
import { commandLifecycleMachine } from '../../../../src/machines/command-lifecycle.ts'

type Lifecycle = typeof commandLifecycleMachine
type LifecycleEvent = EventFrom<Lifecycle>

export const stateLabels: Record<string, string> = {
  validatingInput: 'Checking the input',
  runningWorkflow: 'Reading the web',
  rendering: 'Putting the results together',
  completed: 'Done',
  completedWithPartialFailures: 'Done, but some sources could not be read',
  emptyWithErrors: 'No source could be read',
  rejected: 'The input was rejected',
  failed: 'The command failed',
}

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
}

const eventTypes = commandLifecycleMachine.root.events as LifecycleEvent['type'][]

export const nextMoves = (snapshot: SnapshotFrom<Lifecycle>) =>
  eventTypes.filter((type) => snapshot.can({ type }))

export interface SessionResult {
  readonly topic?: string
  readonly url?: string
  readonly report?: string
  readonly sources?: ReadonlyArray<{ readonly title: string; readonly url: string }>
  readonly links?: ReadonlyArray<string>
  readonly errors?: ReadonlyArray<unknown>
  readonly error?: true
  readonly message?: string
}

// A result means the input passed and the workflow ran; the discovery exit
// rule (src/cli/run.ts) then splits clean, partial, and empty-with-errors.
export const resultEvents = (result: SessionResult): LifecycleEvent[] => {
  if (result.error) return [{ type: 'INPUT_VALID' }, { type: 'WORKFLOW_FAILED' }]
  const errors = result.errors?.length ?? 0
  const found = (result.sources?.length ?? 0) + (result.links?.length ?? 0)
  const end = errors === 0 ? 'NO_ERRORS' : found > 0 ? 'SOME_ERRORS' : 'EMPTY_WITH_ERRORS'
  return [{ type: 'INPUT_VALID' }, { type: 'WORKFLOW_SUCCEEDED' }, { type: end }]
}
