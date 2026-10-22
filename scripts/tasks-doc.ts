// mise run docs:tasks writes docs/tasks.md from `mise tasks --json`;
// mise run docs:tasks:check fails when the committed file differs.
import { BunFileSystem, BunRuntime } from '@effect/platform-bun'
import { Console, Effect, FileSystem, Schema } from 'effect'

const OUT = 'docs/tasks.md'

const Tasks = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      name: Schema.String,
      description: Schema.String,
      depends: Schema.Array(Schema.String),
      hide: Schema.Boolean,
      global: Schema.Boolean,
    }),
  ),
)

const render = (tasks: typeof Tasks.Type): string =>
  [
    '# Mise tasks',
    '',
    'Every webular command runs through a task in [mise.toml](../mise.toml). `mise run docs:tasks` writes this list from `mise tasks --json`, and `mise run docs:tasks:check` fails when it drifts.',
    '',
    'Run `mise run <task>`. Each line gives the task, what it does, and the tasks it runs first.',
    '',
    '```text',
    ...tasks
      .filter((t) => !t.hide && !t.global)
      .map(
        (t) =>
          `${t.name}: ${t.description}${t.depends.length > 0 ? ` [after ${t.depends.join(', ')}]` : ''}`,
      ),
    '```',
    '',
  ].join('\n')

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const raw = yield* Effect.tryPromise(() =>
    new Response(Bun.spawn(['mise', 'tasks', '--json']).stdout).text(),
  )
  const text = render(yield* Schema.decodeUnknownEffect(Tasks)(raw))
  if (!Bun.argv.includes('--check')) return yield* fs.writeFileString(OUT, text)
  const current = yield* fs.readFileString(OUT).pipe(Effect.orElseSucceed(() => ''))
  if (current !== text)
    return yield* Effect.fail(new Error(`${OUT} is stale; run mise run docs:tasks`))
  yield* Console.log(`docs:tasks:check ok: ${OUT} matches mise tasks --json`)
})

program.pipe(
  Effect.tapError((e) => Console.error(`docs:tasks failed: ${String(e)}`)),
  Effect.provide(BunFileSystem.layer),
  BunRuntime.runMain,
)
