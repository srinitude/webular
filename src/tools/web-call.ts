import { type Duration, Effect } from 'effect'
import { CommandFailed, type EntryOf, runCommand } from '../../plugins/webular/src/commands.ts'
import { shortError, stableJson } from '../core/output.ts'

export interface McpText {
  [key: string]: unknown
  content: { type: 'text'; text: string }[]
  isError?: boolean
}
export const failure = (text: string): McpText => ({
  content: [{ type: 'text', text }],
  isError: true,
})

// Tools that can run for minutes; they report progress when the caller asks.
const LONG_TOOLS = new Set(['batch', 'crawl', 'research'])

// What each MCP handler gets besides its arguments (a slice of the SDK's extra).
export interface CallExtra {
  signal: AbortSignal
  _meta?: { progressToken?: string | number | undefined }
  sendNotification: (n: {
    method: 'notifications/progress'
    params: { progressToken: string | number; progress: number; total: number }
  }) => Promise<void>
}

// With a progressToken, a long tool sends notifications/progress: 0 at the
// start, a rising beat every 5 seconds (it resets a client's request timeout),
// and 1 at the end. A lost notification never fails the call.
const progressSender = (extra: CallExtra, token: string | number) => (progress: number) =>
  Effect.ignore(
    Effect.tryPromise(() =>
      extra.sendNotification({
        method: 'notifications/progress',
        params: { progressToken: token, progress, total: 1 },
      }),
    ),
  )

const heartbeats = (send: (progress: number) => Effect.Effect<void>) =>
  Effect.gen(function* () {
    for (let n = 1; ; n++) {
      yield* Effect.sleep('5 seconds')
      yield* send(n / (n + 1))
    }
  })

export const withProgress = <A, E, R>(
  id: string,
  extra: CallExtra,
  work: Effect.Effect<A, E, R>,
) => {
  const token = extra._meta?.progressToken
  if (token === undefined || !LONG_TOOLS.has(id)) return work
  const send = progressSender(extra, token)
  return send(0).pipe(
    Effect.andThen(Effect.raceFirst(work, heartbeats(send))),
    Effect.tap(() => send(1)),
  )
}

// A command tool: the plugin's runCommand, with the result as compact JSON text.
// The plugin's own numeric cursor pages a long result. A call that runs past
// `limit` stops (its child process with it) and returns isError.
const timedOut = (id: string) =>
  Effect.fail(
    new CommandFailed({
      message: `webular ${id} stopped at its time limit. Call it again with a smaller input, or tell the user it took too long.`,
    }),
  )

export const runTool = (
  id: string,
  args: Record<string, unknown>,
  limit: Duration.Input,
  entryOf?: EntryOf,
) =>
  Effect.gen(function* () {
    const { cursor = 0, ...input } = args
    // lenient() passes a bad cursor through; refuse it rather than page from 0.
    if (typeof cursor !== 'number' || !Number.isInteger(cursor) || cursor < 0) {
      return failure('cursor: use the cursor value from the previous result')
    }
    const result = yield* runCommand(id, input, cursor, entryOf).pipe(
      Effect.timeoutOrElse({
        duration: limit,
        orElse: () => timedOut(id),
      }),
    )
    return {
      content: [{ type: 'text', text: stableJson(result) }],
      structuredContent: result,
    } satisfies McpText
  }).pipe(
    Effect.catch((e) =>
      Effect.succeed(failure(e instanceof CommandFailed ? e.message : shortError(e))),
    ),
  )
