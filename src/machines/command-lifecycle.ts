// Command lifecycle inside `mise run run:<command>`: the Mastra workflow
// validates its input, runs, and its result is rendered (src/cli/run.ts).
// Discovery commands keep partial failures in the payload: exit 0 with a
// stderr note, and exit 1 only when the payload is empty and errors exist
// (payloadExit). For answer and research a page with no main text still
// counts: its body text fills in (src/lib/html.ts), so it is not empty.
// Final states carry an `exit-<code>` tag from src/cli/exit-codes.ts.
import { setup } from 'xstate'
import { EXIT, exitTag } from '../cli/exit-codes.ts'

export const commandLifecycleMachine = setup({
  types: {
    events: {} as
      | { type: 'INPUT_INVALID' }
      | { type: 'INPUT_VALID' }
      | { type: 'WORKFLOW_FAILED' }
      | { type: 'WORKFLOW_SUCCEEDED' }
      | { type: 'NO_ERRORS' }
      | { type: 'SOME_ERRORS' }
      | { type: 'EMPTY_WITH_ERRORS' }
      | { type: 'PARTIAL' },
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
        // Explicit-target commands (batch): some named targets failed.
        PARTIAL: 'partial',
      },
    },
    partial: { type: 'final', tags: [exitTag(EXIT.partial)] },
    rejected: { type: 'final', tags: [exitTag(EXIT.failure)] },
    failed: { type: 'final', tags: [exitTag(EXIT.failure)] },
    completed: { type: 'final', tags: [exitTag(EXIT.ok)] },
    completedWithPartialFailures: { type: 'final', tags: [exitTag(EXIT.ok), 'stderr-note'] },
    emptyWithErrors: { type: 'final', tags: [exitTag(EXIT.failure), 'stderr-note'] },
  },
})
