// Guard: AGENTS.md rules that one file read decides but one grep cannot.
// Each check lists every fault it finds.
import { describe, expect } from 'bun:test'
import { Effect, Schema } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { fileChecks, packageJson, read } from '../_support/repo-files.ts'
import { ROOT } from '../_support/root.ts'

const check = fileChecks()

const lines = (text: string) => text.split('\n')

const importers = (pkg: string) =>
  Effect.map(
    runProc(['git', 'grep', '-l', `from '${pkg}`, '--', 'src', 'plugins/webular/src', 'bin'], {
      timeoutMs: 10_000,
      cwd: ROOT,
    }),
    ({ stdout }) => lines(stdout).filter(Boolean),
  )

describe('AGENTS.md file gates', () => {
  check(
    'every bun test task sets a time budget',
    Effect.map(read('mise.toml'), (toml) =>
      expect(
        lines(toml).filter(
          (line) => /\bbun test\b/.test(line) && /^run =/.test(line) && !line.includes('--timeout'),
        ),
      ).toEqual([]),
    ),
  )

  check(
    'every --bytecode build also passes --compile',
    Effect.map(read('mise.toml'), (toml) =>
      expect(
        lines(toml).filter((line) => line.includes('--bytecode') && !line.includes('--compile')),
      ).toEqual([]),
    ),
  )
})

describe('AGENTS.md package gates', () => {
  check(
    '@types/bun matches the bun pin in mise.toml',
    Effect.gen(function* () {
      const toml = yield* read('mise.toml')
      const pin = /^\[tools\][^[]*?^bun = "([^"]+)"/m.exec(toml)?.[1]
      const types = (yield* packageJson).devDependencies['@types/bun']?.replace(/^\^/, '')
      expect(types).toBe(pin)
    }),
  )

  check(
    'no file imports both the MCP SDK and the MCP server package',
    Effect.gen(function* () {
      const sdk = yield* importers('@modelcontextprotocol/sdk')
      const server = new Set(yield* importers('@modelcontextprotocol/server'))
      expect(sdk.filter((file) => server.has(file))).toEqual([])
    }),
  )
})

const Descriptions = Schema.fromJsonString(
  Schema.Struct({ tools: Schema.Record(Schema.String, Schema.Unknown) }),
)

const first = (pattern: RegExp, text: string) => pattern.exec(text)?.[1]

describe('AGENTS.md plugin gates', () => {
  check(
    'plugin tool ids fit every host',
    Effect.gen(function* () {
      const text = yield* read('plugins/webular/src/descriptions.json')
      const ids = Object.keys((yield* Schema.decodeUnknownEffect(Descriptions)(text)).tools)
      expect(
        ids.filter((id) => !/^[a-z][a-z0-9_]*$/.test(id) || `webularwebular_${id}`.length > 60),
      ).toEqual([])
      expect(ids.length).toBeLessThanOrEqual(40)
    }),
  )

  check(
    'the root AGENTS.md states the code-limits numbers',
    Effect.gen(function* () {
      const agents = yield* read('AGENTS.md')
      const limits = yield* read('plugins/webular/scripts/code-limits.ts')
      expect([
        first(/At most (\d+) lines per file/, agents),
        first(/(\d+) lines per function/, agents),
        first(/nesting depth (\d+)/, agents),
      ]).toEqual([
        first(/MAX_FILE = (\d+)/, limits),
        first(/MAX_FUNCTION = (\d+)/, limits),
        first(/MAX_DEPTH = (\d+)/, limits),
      ])
    }),
  )
})
