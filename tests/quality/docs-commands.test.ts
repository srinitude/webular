// Guard: scripts/docs-commands.ts builds one reference page per command, and
// each page names every flag that command's own --help prints. A dropped
// command or flag fails here, so the docs cannot fall behind the CLI.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { commandPages } from '../../scripts/docs-commands.ts'
import { COMMAND_NAMES, COMMANDS } from '../../src/cli/commands.ts'
import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const helpFlags = (help: string): string[] =>
  [...help.matchAll(/^ {2}(?:-\w, )?(--[\w-]+)/gm)].map((m) => m[1] ?? '')

test(
  'one page per command, and each page names every flag of its --help',
  eff(
    Effect.gen(function* () {
      const pages = yield* commandPages()
      expect(pages).toHaveLength(22)
      expect(pages.map((p): string => p.name)).toEqual(Object.keys(COMMANDS))
      yield* Effect.forEach(
        COMMAND_NAMES,
        (name) =>
          Effect.map(runCli(`src/commands/${name}.ts`, ['--help']), ({ out }) => {
            const mdx = pages.find((p) => p.name === name)?.mdx ?? ''
            expect(helpFlags(out).length).toBeGreaterThan(0)
            // Every flag has a one-line description in --help, so its table cell is not empty.
            const bare = out
              .split('\n')
              .filter((l) => /^ {2}(?:-\w, )?--[\w-]+( <[^>]+>)?\s*$/.test(l))
            expect({ name, bare }).toEqual({ name, bare: [] })
            for (const flag of helpFlags(out))
              expect({ name, flag, listed: mdx.includes(`\`${flag}\``) }).toEqual({
                name,
                flag,
                listed: true,
              })
          }),
        { concurrency: 4, discard: true },
      )
    }),
  ),
  120_000,
)

test(
  'each command with a recorded fixture run shows its text and --json output',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const file = yield* fs.readFileString(`${ROOT}docs/site/reference/command-output.json`)
      const recorded = Object.keys(JSON.parse(file) as object)
      const pages = yield* commandPages()
      expect(recorded.length).toBeGreaterThan(0)
      for (const name of recorded) {
        const mdx = pages.find((p) => p.name === name)?.mdx ?? ''
        expect({ name, json: mdx.includes('With `--json`:') }).toEqual({ name, json: true })
      }
    }),
  ),
  120_000,
)
