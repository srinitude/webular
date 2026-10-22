// Release step: writes shell completion scripts (bash, zsh, fish, PowerShell)
// into dist/completions. The command list and every flag come from the same
// coverage map the e2e parity test reads (tests/e2e/surface.ts), so a new
// command or flag is completed with no edit here.
import { join } from 'node:path'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { coverage } from '../../tests/e2e/surface.ts'
import { COMMANDS } from '../cli/commands.ts'
import { completionFiles } from '../cli/completion-script.ts'
import { PACKAGE_ROOT } from '../core/root.ts'

export const writeCompletions = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const { flags, shared } = yield* coverage
    yield* fs.makeDirectory(dir, { recursive: true })
    yield* Effect.forEach(
      completionFiles({ commands: COMMANDS, flags, shared }),
      ([name, text]) => fs.writeFileString(join(dir, name), text),
      { concurrency: 4, discard: true },
    )
  })

if (import.meta.main) {
  BunRuntime.runMain(
    writeCompletions(join(PACKAGE_ROOT, 'dist', 'completions')).pipe(
      Effect.provide(BunServices.layer),
    ),
  )
}
