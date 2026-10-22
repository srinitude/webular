// The webular command tools, shared by both MCP servers: this plugin's Mastra
// server and the CLI's `webular mcp`. Each tool runs one `webular <command>`
// with its input as flags. Nothing here imports Mastra, so the CLI's server
// loads only zod and Effect from this file.
// Self-contained: nothing here reaches outside the plugin folder, so a host
// that copies only this folder still runs it.
import { constants } from 'node:os'
import { Config, Data, Effect, Schema, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { z } from 'zod'
import { cap } from './budget.ts'
import descriptions from './descriptions.json' with { type: 'json' }
import { outputs, schemas } from './schemas.ts'

// Names the command file to start on this process's own runtime. The CLI's
// server passes one, so it runs its own command files.
export type EntryOf = (command: string) => string

// The process a tool call runs: `webular <command>`, from WEBULAR_BIN or PATH.
// The webular launcher picks the native build for this OS and CPU, then starts
// the command directly (src/cli/dispatch.ts commandFor). WEBULAR_COMMANDS_DIR
// (a checkout's src/commands, for tests and development) starts the command
// file on this server's own runtime, as commandFor does. The plugin folder
// stays self-contained, so this mirrors commandFor instead of importing it.
const commandLine = (command: string, args: ReadonlyArray<string>, entryOf?: EntryOf) =>
  Effect.gen(function* () {
    if (entryOf) return ChildProcess.make(process.execPath, [entryOf(command), ...args])
    const dir = yield* Config.String('WEBULAR_COMMANDS_DIR').pipe(Config.withDefault(''))
    if (dir !== '') return ChildProcess.make(process.execPath, [`${dir}/${command}.ts`, ...args])
    const bin = yield* Config.String('WEBULAR_BIN').pipe(Config.withDefault('webular'))
    return ChildProcess.make(bin, [command, ...args])
  })

// A child killed by a signal reports it only in the error text.
const KILLED = /signal: '(\w+)'/

// The CLI's exit-code rule: the child's own code, or 128 + n when signal n
// killed it, so a killed command reads as a failed run, not a failed start.
const exitOf = (exitCode: Effect.Effect<unknown, unknown>) =>
  exitCode.pipe(
    Effect.map(Number),
    Effect.catch((err) => {
      const signal = KILLED.exec(String(err))?.[1] as NodeJS.Signals | undefined
      return signal ? Effect.succeed(128 + (constants.signals[signal] ?? 0)) : Effect.fail(err)
    }),
  )

export class CommandFailed extends Data.TaggedError('CommandFailed')<{
  readonly message: string
}> {}

const decode = (bytes: Stream.Stream<Uint8Array, unknown>) =>
  bytes.pipe(Stream.decodeText(), Stream.mkString)

// camelCase keys become kebab-case flags, true becomes a bare --flag, false and
// undefined drop out, arrays repeat the flag once per item (so a comma inside
// a URL survives).
export const toFlags = (input: Record<string, unknown>) =>
  Object.entries(input).flatMap(([key, v]) => {
    const k = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    if (v === undefined || v === false) return []
    if (v === true) return [`--${k}`]
    // One --key=value token, so a value that starts with '-' is never read as a flag.
    return (Array.isArray(v) ? v : [v]).map((item) => `--${k}=${String(item)}`)
  })

// Picks the next step by exit code: 2 is bad input, anything else is the site or the network.
const failure = (command: string, code: number, err: string) => {
  const why = err.trim() || `exit code ${code}`
  return new CommandFailed({
    message:
      code === 2
        ? `webular ${command} failed: ${why}. Fix the input and call it again.`
        : `webular ${command} failed: ${why}. The input looked valid. Try another URL, or tell the user the site could not be read.`,
  })
}

const startFailed = (command: string, e: unknown) =>
  new CommandFailed({
    message: `webular ${command} could not start: ${String(e)}. Check that webular is installed and on PATH, or that WEBULAR_BIN names it. Then restart the MCP server.`,
  })

const notJson = (command: string) =>
  new CommandFailed({
    message: `webular ${command} returned output that is not JSON. This is a webular bug. Do not retry. Tell the user, and include the tool name.`,
  })

const decodeResult = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
)

// Runs `webular <command> --json` with the tool input as flags; stdout is the
// result, cut to one page that starts at `from`.
export const runCommand = (
  command: string,
  input: Record<string, unknown>,
  from = 0,
  entryOf?: EntryOf,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const line = yield* commandLine(command, [...toFlags(input), '--json'], entryOf)
      const proc = yield* spawner.spawn(line)
      const [out, err, code] = yield* Effect.all(
        [decode(proc.stdout), decode(proc.stderr), exitOf(proc.exitCode)],
        { concurrency: 3 },
      )
      // Exit 3 is the CLI's partial result: stdout holds every item, failed ones named.
      if (code !== 0 && code !== 3) return yield* failure(command, code, err)
      return yield* decodeResult(out).pipe(
        Effect.mapError(() => notJson(command)),
        Effect.map((result) => cap(result, command, from)),
      )
    }),
  ).pipe(Effect.mapError((e) => (e instanceof CommandFailed ? e : startFailed(command, e))))

export type Command = keyof typeof schemas

const writesFiles = new Set<Command>(['media', 'act'])
// Commands that read only this computer, never the web.
const localOnly = new Set<Command>(['parse', 'tasks', 'diagram', 'audit'])
// Every command result is a JSON object; cap() keeps it one.
const outputSchema = z.looseObject({})
const cursor = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe('Where to pick up a cut result: the cursor value it returned')

// One entry per command tool, sorted by id: registration order is tools/list order.
export const commandTools = (Object.keys(schemas) as Command[]).sort().map((id) => ({
  id,
  title: descriptions.titles[id],
  description: descriptions.tools[id],
  inputSchema: z.strictObject({ ...schemas[id].shape, cursor }),
  outputSchema: outputs[id] ?? outputSchema,
  annotations: {
    title: descriptions.titles[id],
    readOnlyHint: !writesFiles.has(id),
    openWorldHint: !localOnly.has(id),
  },
}))
