// The `machine.next` tool: the Stately agent's view of a machine after replaying
// events. Machines load lazily so `mcp --list` stays fast.
import { Data, Effect } from 'effect'
import { z } from 'zod'
import { errMsg } from '../core/output.ts'

export class ToolArgsError extends Data.TaggedError('ToolArgsError')<{
  readonly message: string
}> {}

export const paging = {
  cursor: z.string().optional().describe('nextCursor from the previous page'),
  select: z.array(z.string()).optional().describe('Top-level result select to keep'),
}

export const machineSchema = z.object({
  machine: z.enum(['cliDispatch', 'commandLifecycle', 'fetch', 'mcpServe', 'scrapeFallback']),
  events: z.array(z.string()).max(64).default([]),
  ...paging,
})

const lazy = <T>(load: () => Promise<T>) =>
  Effect.tryPromise({ try: load, catch: (e) => new ToolArgsError({ message: errMsg(e) }) })

// One lazy loader per machine, so a replay imports only the machine it names.
const machines = {
  cliDispatch: lazy(() => import('../machines/cli-dispatch.ts')).pipe(
    Effect.map((m) => m.cliDispatchMachine),
  ),
  commandLifecycle: lazy(() => import('../machines/command-lifecycle.ts')).pipe(
    Effect.map((m) => m.commandLifecycleMachine),
  ),
  fetch: lazy(() => import('../machines/fetch.ts')).pipe(Effect.map((m) => m.fetchMachine)),
  mcpServe: lazy(() => import('../machines/mcp-serve.ts')).pipe(
    Effect.map((m) => m.mcpServeMachine),
  ),
  scrapeFallback: lazy(() => import('../machines/scrape-fallback.ts')).pipe(
    Effect.map((m) => m.scrapeFallbackMachine),
  ),
}

export const machineState = (name: z.infer<typeof machineSchema>['machine'], events: string[]) =>
  Effect.all([lazy(() => import('../machines/agent.ts')), machines[name]]).pipe(
    Effect.map(([agent, machine]) => {
      const snapshot = agent.replay(
        machine,
        events.map((type) => ({ type })),
      )
      return {
        state: snapshot.value,
        next: agent.allowedEvents(snapshot),
        done: snapshot.status === 'done',
        tags: [...snapshot.tags],
      }
    }),
  )
