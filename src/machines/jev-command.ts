// `webular jev` (src/commands/jev.ts) is the one command with its own flow, not
// the command lifecycle: its argv picks help, `learn`, `correct`, or a usage
// error, and each of the two actions then succeeds or fails.
// Final states carry an `exit-<code>` tag from src/cli/exit-codes.ts.
import { setup, types } from 'xstate'
import { EXIT, exitTag } from '../cli/exit-codes.ts'

const RESULT = (done: string, failed: string) => ({
  on: { SUCCEEDED: { target: done }, FAILED: { target: failed } },
})

export const jevCommandMachine = setup({
  schemas: {
    events: {
      HELP: types<void>(),
      LEARN: types<void>(),
      CORRECT: types<void>(),
      USAGE_ERROR: types<void>(),
      SUCCEEDED: types<void>(),
      FAILED: types<void>(),
    },
  },
}).createMachine({
  id: 'jevCommand',
  initial: 'parsingArgv',
  states: {
    parsingArgv: {
      on: {
        HELP: { target: 'printedHelp' },
        LEARN: { target: 'learning' },
        CORRECT: { target: 'correcting' },
        USAGE_ERROR: { target: 'rejected' },
      },
    },
    learning: RESULT('learned', 'learnFailed'),
    correcting: RESULT('corrected', 'correctFailed'),
    printedHelp: { type: 'final', tags: [exitTag(EXIT.ok)] },
    learned: { type: 'final', tags: [exitTag(EXIT.ok)] },
    corrected: { type: 'final', tags: [exitTag(EXIT.ok)] },
    rejected: { type: 'final', tags: [exitTag(EXIT.usage)] },
    learnFailed: { type: 'final', tags: [exitTag(EXIT.failure)] },
    correctFailed: { type: 'final', tags: [exitTag(EXIT.failure)] },
  },
})
