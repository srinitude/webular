// Usage errors and help a person can act on: every error names the next step,
// a stray flag before the command is called an option, every command's
// --help ends with a real example, and jev's help says what jev is for.
import { describe, expect, test } from 'bun:test'
import { Config, Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { eff } from '../_support/run.ts'

// Windows names them Path and USERPROFILE.
const baseEnv = Effect.all({
  PATH: Config.String('PATH').pipe(Config.orElse(() => Config.String('Path'))),
  HOME: Config.String('HOME').pipe(Config.orElse(() => Config.String('USERPROFILE'))),
})
const piped = (args: string[], extra: Record<string, string> = {}) =>
  Effect.flatMap(baseEnv, (base) =>
    runCli('bin/webular.ts', args, {
      env: { ...base, WEBULAR_JEV: 'off', ...extra },
      exec: process.execPath,
    }),
  )

describe('usage errors name a next step', () => {
  test(
    'a missing argument ends with a help line; a flag typo gets a guess',
    eff(
      Effect.gen(function* () {
        const missing = yield* piped(['scrape'])
        expect(missing.code).toBe(2)
        expect(missing.err).toBe(
          "scrape: missing --url <url>\nRun 'webular scrape --help' to see how to use it.\n",
        )
        const typo = yield* piped(['scrape', '--ulr', 'x'])
        expect(typo.code).toBe(2)
        expect(typo.err).toContain("Did you mean '--url'? Run 'webular scrape --help'")
        expect(typo.out).toBe('')
      }),
    ),
    20_000,
  )

  test(
    'a flag in the command slot is an unknown option',
    eff(
      Effect.gen(function* () {
        const run = yield* piped(['--bogus'])
        expect(run.code).toBe(2)
        expect(run.err).toContain("unknown option '--bogus'.")
      }),
    ),
    20_000,
  )
})

describe('a usage error inside a command wears the red error label only when color is on', () => {
  const RED = '\x1b[31merror:\x1b[0m scrape: missing --url <url>'
  test(
    'FORCE_COLOR adds the label; NO_COLOR, FORCE_COLOR=0, TERM=dumb, and a pipe keep the plain line',
    eff(
      Effect.gen(function* () {
        expect((yield* piped(['scrape'], { FORCE_COLOR: '1' })).err).toStartWith(RED)
        for (const extra of [
          { FORCE_COLOR: '1', NO_COLOR: '1' },
          { FORCE_COLOR: '0' },
          { TERM: 'dumb' },
          {},
        ]) {
          const run = yield* piped(['scrape'], extra)
          expect(run.err).toStartWith('scrape: missing --url <url>')
          expect(run.err).not.toContain('\x1b[')
        }
      }),
    ),
    30_000,
  )
})

describe('help shows what a command is for and a real example', () => {
  test(
    'command help ends with an EXAMPLE block',
    eff(
      Effect.gen(function* () {
        const run = yield* piped(['map', '--help'])
        expect(run.code).toBe(0)
        expect(run.out).toContain('\n  webular map <url> [options]\n')
        expect(run.out.trimEnd().endsWith('EXAMPLE\n  webular map https://example.com')).toBe(true)
      }),
    ),
    20_000,
  )

  test(
    'jev help names its purpose and a bad subcommand points at help',
    eff(
      Effect.gen(function* () {
        const help = yield* piped(['jev', '-h'])
        expect(help.code).toBe(0)
        expect(help.out.startsWith('webular jev — ')).toBe(true)
        const none = yield* piped(['jev'])
        expect(none.code).toBe(2)
        expect(none.err).toStartWith('jev: missing a command. Pass learn or correct.')
        const bad = yield* piped(['jev', 'nope'])
        expect(bad.code).toBe(2)
        expect(bad.err).toContain("jev: 'nope' needs more, or is not a jev command.")
        expect(bad.err.trimEnd().endsWith("Run 'webular jev --help' to see how to use it.")).toBe(
          true,
        )
      }),
    ),
    20_000,
  )
})
