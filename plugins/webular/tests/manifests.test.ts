// Outcome evals for the manifests: each host finds the plugin where it looks,
// the plugin folder runs on its own, and no dev-only address ships.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'

const root = fileURLToPath(new URL('..', import.meta.url))
const repo = fileURLToPath(new URL('../../../', import.meta.url))
const shipped = ['mcp.json', '.mcp.json', 'plugin.json', '.claude-plugin/plugin.json']
const claudeRoot = ['$', '{CLAUDE_PLUGIN_ROOT}'].join('')

const read = (path: string) =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fs) => fs.readFileString(path)),
    Effect.provide(BunServices.layer),
  )

const readJson = <S extends Schema.Top>(path: string, schema: S) =>
  read(path).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(schema))))

const verify =
  <A>(check: (a: A) => void) =>
  <E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.flatMap(self, (a) => Effect.sync(() => check(a)))

const McpConfig = Schema.Struct({
  mcpServers: Schema.Record(
    Schema.String,
    Schema.Struct({ command: Schema.String, args: Schema.Array(Schema.String) }),
  ),
})
const Named = Schema.Struct({ name: Schema.String, version: Schema.String })
const Marketplace = Schema.Struct({
  name: Schema.String,
  owner: Schema.Struct({ name: Schema.String }),
  plugins: Schema.Array(Schema.Struct({ name: Schema.String, source: Schema.String })),
})

const serverArgs = (path: string) =>
  readJson(`${root}${path}`, McpConfig).pipe(
    Effect.map(({ mcpServers }) =>
      Object.entries(mcpServers).map(([name, s]) => [name, s.command, ...s.args]),
    ),
  )

const noneContain = (paths: ReadonlyArray<string>, needle: string) =>
  Effect.forEach(paths, read, { concurrency: 4 }).pipe(
    verify((texts) => {
      for (const text of texts) expect(text).not.toContain(needle)
    }),
  )

test('mcp.json and .mcp.json start only the plugin server, from inside the plugin', () =>
  Effect.runPromise(
    Effect.all([serverArgs('mcp.json'), serverArgs('.mcp.json')], { concurrency: 2 }).pipe(
      verify(([spec, claude]) => {
        expect(spec).toEqual([['webular', 'bun', './src/server.ts']])
        expect(claude).toEqual([['webular', 'bun', `${claudeRoot}/src/server.ts`]])
      }),
    ),
  ))

test('no shipped manifest names the portless dev URL', () =>
  Effect.runPromise(
    noneContain(
      [...shipped.map((p) => `${root}${p}`), `${repo}.claude-plugin/marketplace.json`],
      '.localhost',
    ),
  ))

test('the Claude Code manifest and marketplace entry match the plugin and the package', () =>
  Effect.runPromise(
    Effect.all(
      [
        readJson(`${root}plugin.json`, Named),
        readJson(`${root}.claude-plugin/plugin.json`, Named),
        readJson(`${repo}package.json`, Named),
        readJson(`${repo}.claude-plugin/marketplace.json`, Marketplace),
      ],
      { concurrency: 4 },
    ).pipe(
      verify(([spec, claude, pkg, market]) => {
        expect(claude).toEqual(spec)
        expect(claude.version).toBe(pkg.version)
        expect(market.plugins).toEqual([{ name: claude.name, source: './plugins/webular' }])
      }),
    ),
  ))

test('plugin code never reaches outside the plugin folder', () =>
  Effect.runPromise(
    noneContain(
      ['server.ts', 'budget.ts', 'runtime.ts', 'schemas.ts'].map((f) => `${root}src/${f}`),
      '../../',
    ),
  ))
