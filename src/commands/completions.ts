// COMPLETIONS command entry — invoked by `mise run run:completions`. Prints the
// completion script for one shell (bash, zsh, fish, powershell) to stdout, the
// same text the release step writes to dist/completions.
import { join } from 'node:path'
import { Console, Effect, FileSystem } from 'effect'
import { COMMAND_NAMES, COMMANDS } from '../cli/commands.ts'
import { completionFiles } from '../cli/completion-script.ts'
import { EXIT } from '../cli/exit-codes.ts'
import { parseFlags, strFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'
import { PACKAGE_ROOT } from '../core/root.ts'

const SHELLS = { bash: 0, zsh: 1, fish: 2, powershell: 3 } as const
const SPEC = /'?([a-z][a-z-]*)'?: \{ type: '(?:string|boolean)'/g
const specNames = (text: string) => [...text.matchAll(SPEC)].map((m) => m[1] as string)

// Flag names come from each command's own flag table, read from the source.
// ponytail: a standalone executable ships no source, so it completes commands
// and stops there; embed a generated flag table if flag completion matters there.
const flagsOf = (file: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.readFileString(join(PACKAGE_ROOT, 'src', file)).pipe(
      Effect.map(specNames),
      Effect.orElseSucceed((): string[] => []),
    ),
  )

const spec = Effect.gen(function* () {
  const shared = yield* flagsOf('core/args.ts')
  const own = yield* Effect.forEach(COMMAND_NAMES, (cmd) => flagsOf(`commands/${cmd}.ts`), {
    concurrency: 8,
  })
  return {
    commands: COMMANDS,
    flags: Object.fromEntries(COMMAND_NAMES.map((c, i) => [c, own[i] ?? []])),
    shared,
  }
})

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    shell: { type: 'string' },
  })
  const shell = strFlag(values, 'shell') ?? positionals[0] ?? ''
  if (!Object.hasOwn(SHELLS, shell)) {
    const message = `completions: pick a shell: ${Object.keys(SHELLS).join(', ')} (got "${shell}")`
    return yield* new CliError({ message, exitCode: EXIT.usage })
  }
  const file = completionFiles(yield* spec)[SHELLS[shell as keyof typeof SHELLS]]
  yield* Console.log(file[1].trimEnd())
  return EXIT.ok
})

runMain(main)
