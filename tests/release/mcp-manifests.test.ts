// MCP manifests: the plugin's mcp.json, the MCP Registry's server.json, and
// package.json's mcpName agree, and every bare import resolves to a listed package.
import { expect, test } from 'bun:test'
import { builtinModules } from 'node:module'
import { Effect, FileSystem, Schema } from 'effect'
import { eff } from '../_support/run.ts'

const Json = Schema.fromJsonString(Schema.Any)
const readJson = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return yield* Schema.decodeUnknownEffect(Json)(yield* fs.readFileString(path))
  })

const pkgName = (spec: string) =>
  spec
    .split('/')
    .slice(0, spec.startsWith('@') ? 2 : 1)
    .join('/')
const isBare = (spec: string) =>
  !/^(\.|\/|node:|bun:|#)/.test(spec) && !builtinModules.includes(spec.split('/')[0] ?? '')

const SCAN_ROOTS = ['src', 'tests', 'scripts', 'plugins/webular/src', 'plugins/webular/tests']

test(
  'plugin mcp.json declares its schema and a stdio server',
  eff(
    Effect.gen(function* () {
      const mcp = yield* readJson('plugins/webular/mcp.json')
      expect(mcp.$schema).toBeString()
      expect(mcp.mcpServers.webular.type).toBe('stdio')
    }),
  ),
)

test(
  'server.json names the same MCP server as package.json mcpName',
  eff(
    Effect.gen(function* () {
      const pkg = yield* readJson('package.json')
      const server = yield* readJson('server.json')
      expect(server.$schema).toBe(
        'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
      )
      expect(pkg.mcpName).toBe('io.github.srinitude/webular')
      expect(server.name).toBe(pkg.mcpName)
      expect(server.version).toBe(pkg.version)
      expect(server.packages[0]).toMatchObject({
        registryType: 'npm',
        identifier: pkg.name,
        version: pkg.version,
        transport: { type: 'stdio' },
        environmentVariables: [
          { name: 'TYPESAFE_API_KEY', isRequired: false, isSecret: true, format: 'string' },
        ],
      })
      // npx runs the npm package with Node only; a bunx hint would require Bun.
      expect(server.packages[0].runtimeHint).toBeUndefined()
    }),
  ),
)

const importsOf = (transpiler: Bun.Transpiler, file: string) =>
  Effect.promise(() => Bun.file(file).text()).pipe(
    Effect.map((src) =>
      transpiler
        .scanImports(src.replace(/^#!.*/, ''))
        .map((i) => i.path)
        .filter(isBare)
        .map((spec) => [pkgName(spec), file] as const),
    ),
  )

test(
  'every imported bare package is listed in a package.json',
  eff(
    Effect.gen(function* () {
      const pkgs = [
        yield* readJson('package.json'),
        yield* readJson('plugins/webular/package.json'),
      ]
      const listed = new Set(
        pkgs.flatMap((p) =>
          Object.keys({ ...p.dependencies, ...p.devDependencies, ...p.optionalDependencies }),
        ),
      )
      const files = SCAN_ROOTS.flatMap((root) => [...new Bun.Glob(`${root}/**/*.ts`).scanSync('.')])
      const transpiler = new Bun.Transpiler({ loader: 'ts' })
      const found = (yield* Effect.forEach(files, (f) => importsOf(transpiler, f), {
        concurrency: 8,
      })).flat()
      const missing = found.filter(([name]) => !listed.has(name)).map(([n, f]) => `${n} (${f})`)
      expect([...new Set(missing)]).toEqual([])
    }),
  ),
)
