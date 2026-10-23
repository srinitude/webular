// Command lifecycle inside `mise run run:<command>`: the Mastra workflow
// validates its input, runs, and its result is rendered (src/cli/run.ts).
// Discovery commands keep partial failures in the payload: exit 0 with a
// stderr note, and exit 1 only when the payload is empty and errors exist
// (payloadExit). For answer and research a page with no main text still
// counts: its body text fills in (src/lib/html.ts), so it is not empty.
// Final states carry an `exit-<code>` tag from src/cli/exit-codes.ts.
import { setup, types } from 'xstate'
import { EXIT, exitTag } from '../cli/exit-codes.ts'

export const commandLifecycleMachine = setup({
  schemas: {
    events: {
      INPUT_INVALID: types<void>(),
      INPUT_VALID: types<void>(),
      WORKFLOW_FAILED: types<void>(),
      WORKFLOW_SUCCEEDED: types<void>(),
      NO_ERRORS: types<void>(),
      SOME_ERRORS: types<void>(),
      EMPTY_WITH_ERRORS: types<void>(),
      PARTIAL: types<void>(),
    },
  },
}).createMachine({
  id: 'commandLifecycle',
  initial: 'validatingInput',
  states: {
    validatingInput: {
      on: { INPUT_INVALID: { target: 'rejected' }, INPUT_VALID: { target: 'runningWorkflow' } },
    },
    runningWorkflow: {
      on: { WORKFLOW_FAILED: { target: 'failed' }, WORKFLOW_SUCCEEDED: { target: 'rendering' } },
    },
    rendering: {
      on: {
        NO_ERRORS: { target: 'completed' },
        SOME_ERRORS: { target: 'completedWithPartialFailures' },
        EMPTY_WITH_ERRORS: { target: 'emptyWithErrors' },
        // Explicit-target commands (batch): some named targets failed.
        PARTIAL: { target: 'partial' },
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
