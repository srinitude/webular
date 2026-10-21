// CLI dispatch: `webular <argv>` either answers locally (help, version,
// unknown command) or routes to `mise run run:<command>` and passes the task's
// exit code through. The CLI never runs capability code itself (bin/webular.ts,
// src/cli/route.ts). Final states carry an `exit-<code>` tag.
import { setup } from 'xstate'

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
    printedHelp: { type: 'final', tags: ['exit-0'] },
    printedVersion: { type: 'final', tags: ['exit-0'] },
    rejected: { type: 'final', tags: ['exit-1'] },
    taskSucceeded: { type: 'final', tags: ['exit-0'] },
    taskFailed: { type: 'final', tags: ['exit-1'] },
  },
})
