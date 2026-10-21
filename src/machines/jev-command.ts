// `webular jev` (src/commands/jev.ts) is the one command with its own flow, not
// the command lifecycle: its argv picks help, `learn`, `correct`, or a usage
// error, and each of the two actions then succeeds or fails.
// Final states carry an `exit-<code>` tag from src/cli/exit-codes.ts.
import { setup } from 'xstate'
import { EXIT, exitTag } from '../cli/exit-codes.ts'

const RESULT = (done: string, failed: string) => ({
  on: { SUCCEEDED: done, FAILED: failed },
})

export const jevCommandMachine = setup({
  types: {
    events: {} as
      | { type: 'HELP' }
      | { type: 'LEARN' }
      | { type: 'CORRECT' }
      | { type: 'USAGE_ERROR' }
      | { type: 'SUCCEEDED' }
      | { type: 'FAILED' },
  },
}).createMachine({
  id: 'jevCommand',
  initial: 'parsingArgv',
  states: {
    parsingArgv: {
      on: {
        HELP: 'printedHelp',
        LEARN: 'learning',
        CORRECT: 'correcting',
        USAGE_ERROR: 'rejected',
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
