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
  machine: z.enum(['cliDispatch', 'commandLifecycle', 'fetch']),
  events: z.array(z.string()).max(64).default([]),
  ...paging,
})

const lazy = <T>(load: () => Promise<T>) =>
  Effect.tryPromise({ try: load, catch: (e) => new ToolArgsError({ message: errMsg(e) }) })

const loadMachines = Effect.all(
  [
    lazy(() => import('../machines/agent.ts')),
    lazy(() => import('../machines/cli-dispatch.ts')),
    lazy(() => import('../machines/command-lifecycle.ts')),
    lazy(() => import('../machines/fetch.ts')),
  ],
  { concurrency: 4 },
)

export const machineState = (name: z.infer<typeof machineSchema>['machine'], events: string[]) =>
  loadMachines.pipe(
    Effect.map(([agent, cli, lifecycle, fetch]) => {
      const machine = {
        cliDispatch: cli.cliDispatchMachine,
        commandLifecycle: lifecycle.commandLifecycleMachine,
        fetch: fetch.fetchMachine,
      }[name]
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
