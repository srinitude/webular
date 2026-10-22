// CLI dispatch: `webular <argv>` either answers locally (help, version,
// unknown command) or routes to `mise run run:<command>` and passes the task's
// exit code through. The CLI never runs capability code itself (bin/webular.ts,
// src/cli/route.ts). Final states carry an `exit-<code>` tag from src/cli/exit-codes.ts.
import { setup } from 'xstate'
import { EXIT, exitTag } from '../cli/exit-codes.ts'

export const cliDispatchMachine = setup({
  types: {
    events: {} as
      | { type: 'HELP' }
      | { type: 'VERSION' }
      | { type: 'UNKNOWN_COMMAND' }
      | { type: 'KNOWN_COMMAND' }
      | { type: 'TASK_SUCCEEDED' }
      | { type: 'TASK_FAILED' },
  },
}).createMachine({
  id: 'cliDispatch',
  initial: 'parsingArgv',
  states: {
    parsingArgv: {
      on: {
        HELP: 'printedHelp',
        VERSION: 'printedVersion',
        UNKNOWN_COMMAND: 'rejected',
        KNOWN_COMMAND: 'runningMiseTask',
      },
    },
    runningMiseTask: {
      on: { TASK_SUCCEEDED: 'taskSucceeded', TASK_FAILED: 'taskFailed' },
    },
    printedHelp: { type: 'final', tags: [exitTag(EXIT.ok)] },
    printedVersion: { type: 'final', tags: [exitTag(EXIT.ok)] },
    rejected: { type: 'final', tags: [exitTag(EXIT.usage)] },
    taskSucceeded: { type: 'final', tags: [exitTag(EXIT.ok)] },
    // A failed task passes its own exit through: the first tag (1) is the
    // usual one; the rest are the other exits a command or its start can end with.
    taskFailed: {
      type: 'final',
      tags: [
        exitTag(EXIT.failure),
        exitTag(EXIT.usage),
        exitTag(EXIT.partial),
        exitTag(EXIT.toolchainMissing),
        exitTag(EXIT.interrupted),
      ],
    },
  },
})
