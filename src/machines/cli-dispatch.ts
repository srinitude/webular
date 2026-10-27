// CLI dispatch: `webular <argv>` either answers locally (help, version,
// unknown command) or routes to `mise run run:<command>` and passes the task's
// exit code through. The CLI never runs capability code itself (bin/webular.ts,
// src/cli/route.ts). Final states carry an `exit-<code>` tag from src/cli/exit-codes.ts.
import { setup, types } from 'xstate'
import { EXIT, exitTag } from '../cli/exit-codes.ts'

export const cliDispatchMachine = setup({
  schemas: {
    events: {
      HELP: types<void>(),
      VERSION: types<void>(),
      UNKNOWN_COMMAND: types<void>(),
      KNOWN_COMMAND: types<void>(),
      TASK_SUCCEEDED: types<void>(),
      TASK_FAILED: types<void>(),
    },
  },
}).createMachine({
  id: 'cliDispatch',
  initial: 'parsingArgv',
  states: {
    parsingArgv: {
      on: {
        HELP: { target: 'printedHelp' },
        VERSION: { target: 'printedVersion' },
        UNKNOWN_COMMAND: { target: 'rejected' },
        KNOWN_COMMAND: { target: 'runningMiseTask' },
      },
    },
    runningMiseTask: {
      on: { TASK_SUCCEEDED: { target: 'taskSucceeded' }, TASK_FAILED: { target: 'taskFailed' } },
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
