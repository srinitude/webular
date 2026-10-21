// Command lifecycle inside `mise run run:<command>`: the Mastra workflow
// validates its input, runs, and its result is rendered (src/cli/run.ts).
// Discovery commands keep partial failures in the payload: exit 0 with a
// stderr note, and exit 1 only when the payload is empty and errors exist.
// Final states carry an `exit-<code>` tag.
import { setup } from 'xstate'

export const commandLifecycleMachine = setup({
  types: {
    events: {} as
      | { type: 'INPUT_INVALID' }
      | { type: 'INPUT_VALID' }
      | { type: 'WORKFLOW_FAILED' }
      | { type: 'WORKFLOW_SUCCEEDED' }
      | { type: 'NO_ERRORS' }
      | { type: 'SOME_ERRORS' }
      | { type: 'EMPTY_WITH_ERRORS' },
  },
}).createMachine({
  id: 'commandLifecycle',
  initial: 'validatingInput',
  states: {
    validatingInput: {
      on: { INPUT_INVALID: 'rejected', INPUT_VALID: 'runningWorkflow' },
    },
    runningWorkflow: {
      on: { WORKFLOW_FAILED: 'failed', WORKFLOW_SUCCEEDED: 'rendering' },
    },
    rendering: {
      on: {
        NO_ERRORS: 'completed',
        SOME_ERRORS: 'completedWithPartialFailures',
        EMPTY_WITH_ERRORS: 'emptyWithErrors',
      },
    },
    rejected: { type: 'final', tags: ['exit-1'] },
    failed: { type: 'final', tags: ['exit-1'] },
    completed: { type: 'final', tags: ['exit-0'] },
    completedWithPartialFailures: { type: 'final', tags: ['exit-0', 'stderr-note'] },
    emptyWithErrors: { type: 'final', tags: ['exit-1', 'stderr-note'] },
  },
})
