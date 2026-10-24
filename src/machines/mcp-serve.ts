// MCP serve (src/commands/mcp.ts, tools from src/tools/web.ts): `webular mcp`
// starts serving over stdio. A valid tool call answers; a call whose args fail
// the tool's schema, or that names no tool, gets an error result; after each
// the server keeps serving. Stdin closing stops the server (final `stopped`).
// Each serving state names the last outcome, so a path walk covers every order.
import { setup, types } from 'xstate'

const SERVING = {
  on: {
    TOOL_OK: { target: 'answered' },
    TOOL_INVALID_ARGS: { target: 'rejectedArgs' },
    TOOL_UNKNOWN: { target: 'rejectedUnknown' },
    STOP: { target: 'stopped' },
  },
} as const

export const mcpServeMachine = setup({
  schemas: {
    events: {
      TOOL_OK: types<void>(),
      TOOL_INVALID_ARGS: types<void>(),
      TOOL_UNKNOWN: types<void>(),
      STOP: types<void>(),
    },
  },
}).createMachine({
  id: 'mcpServe',
  initial: 'serving',
  states: {
    serving: SERVING,
    answered: SERVING,
    rejectedArgs: SERVING,
    rejectedUnknown: SERVING,
    stopped: { type: 'final' },
  },
})
