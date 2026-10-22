// Guard: docs/commands.md, the `webular --help` list, src/cli/dispatch-table.ts,
// and the run:* tasks in mise.toml name the same commands, and every --flag the
// doc table mentions shows up in that command's own --help.
import { expect, test } from 'bun:test'
import { Config, Effect } from 'effect'
import { COMMAND_NAMES } from '../../src/cli/commands.ts'
import { DISPATCH } from '../../src/cli/dispatch-table.ts'
import { runCli } from '../_support/cli.ts'
import { read } from '../_support/repo-files.ts'
import { eff } from '../_support/run.ts'

const rows = (md: string) =>
  [...md.matchAll(/^\| `(\w+)`\s*\| (.*) \|$/gm)].map((m) => ({
    name: m[1] ?? '',
    text: m[2] ?? '',
  }))
const flags = (text: string) => [...new Set(text.match(/--[a-z][a-z-]*/g) ?? [])]

const help = (args: string[]) =>
  Effect.flatMap(Config.String('PATH').pipe(Config.orElse(() => Config.String('Path'))), (PATH) =>
    runCli('bin/webular.ts', args, { env: { PATH, WEBULAR_JEV: 'off' }, exec: process.execPath }),
  )

test(
  'docs/commands.md lists exactly the commands of the CLI, in order',
  eff(
    Effect.gen(function* () {
      const doc = rows(yield* read('docs/commands.md')).map((r) => r.name)
      const top = (yield* help(['--help'])).out
      const block = top.slice(top.indexOf('COMMANDS'), top.indexOf('GLOBAL OPTIONS'))
      const listed = [...block.matchAll(/^ {2}(\w+) /gm)].map((m) => m[1])
      expect(doc).toEqual([...COMMAND_NAMES])
      expect(listed).toEqual([...COMMAND_NAMES])
      expect(Object.keys(DISPATCH)).toEqual([...COMMAND_NAMES].sort())
    }),
  ),
  30_000,
)

test(
  'the run:* tasks in mise.toml match the commands',
  eff(
    Effect.map(read('mise.toml'), (toml) =>
      expect([...toml.matchAll(/^\[tasks\."run:(\w+)"\]/gm)].map((m) => m[1])).toEqual([
        ...COMMAND_NAMES,
      ]),
    ),
  ),
)

test(
  'every --flag in the doc table appears in that command --help',
  eff(
    Effect.gen(function* () {
      const withFlags = rows(yield* read('docs/commands.md')).filter((r) => flags(r.text).length)
      for (const r of withFlags) {
        const out = (yield* help([r.name, '--help'])).out
        for (const f of flags(r.text))
          expect({ cmd: r.name, flag: f, ok: out.includes(f) }).toEqual({
            cmd: r.name,
            flag: f,
            ok: true,
          })
      }
    }),
  ),
  60_000,
)
