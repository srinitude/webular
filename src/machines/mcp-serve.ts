// MCP serve (src/commands/mcp.ts, tools from src/tools/web.ts): `webular mcp`
// starts serving over stdio. A valid tool call answers; a call whose args fail
// the tool's schema, or that names no tool, gets an error result; after each
// the server keeps serving. Stdin closing stops the server (final `stopped`).
// Each serving state names the last outcome, so a path walk covers every order.
import { setup } from 'xstate'

const SERVING = {
  on: {
    TOOL_OK: 'answered',
    TOOL_INVALID_ARGS: 'rejectedArgs',
    TOOL_UNKNOWN: 'rejectedUnknown',
    STOP: 'stopped',
  },
} as const

export const mcpServeMachine = setup({
  types: {
    events: {} as
      | { type: 'TOOL_OK' }
      | { type: 'TOOL_INVALID_ARGS' }
      | { type: 'TOOL_UNKNOWN' }
      | { type: 'STOP' },
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
