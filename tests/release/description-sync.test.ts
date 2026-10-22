// One description source: package.json "description". Every other surface
// copies it, so the text cannot drift. The one exception is the marketplace
// plugin entry: it copies the plugin manifest (plugins/webular/plugin.json),
// whose description also names the plugin's skills. The comparison reads each file; no text
// is hardcoded here. server.json has a registry cap of 100 characters, so its
// rule is: the source when it fits, else a prefix of the source that ends at a
// clause break (a dash, comma, colon, semicolon, or period comes next).
import { expect, test } from 'bun:test'
import { Effect, FileSystem, Schema } from 'effect'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const SERVER_JSON_CAP = 100
const Described = Schema.Struct({ description: Schema.String })
const Marketplace = Schema.Struct({ plugins: Schema.Array(Described) })
const decode = <S extends Schema.Top>(schema: S) =>
  Schema.decodeUnknownEffect(Schema.fromJsonString(schema))

const readText = (file: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(`${ROOT}${file}`))
const readDescription = (file: string) =>
  readText(file).pipe(
    Effect.flatMap(decode(Described)),
    Effect.map((j) => j.description),
  )
const source = readDescription('package.json')

test(
  'CITATION.cff abstract equals the package description',
  eff(
    Effect.gen(function* () {
      const line = (yield* readText('CITATION.cff')).match(/^abstract: (.*)$/m)?.[1] ?? '""'
      const description = yield* decode(Schema.String)(line)
      expect({ file: 'CITATION.cff', description }).toEqual({
        file: 'CITATION.cff',
        description: yield* source,
      })
    }),
  ),
)

test(
  'marketplace plugin descriptions equal the plugin manifest description',
  eff(
    Effect.gen(function* () {
      const expected = yield* readDescription('plugins/webular/plugin.json')
      for (const file of ['.claude-plugin/marketplace.json', '.cursor-plugin/marketplace.json']) {
        const { plugins } = yield* readText(file).pipe(Effect.flatMap(decode(Marketplace)))
        expect(plugins.length).toBeGreaterThan(0)
        for (const plugin of plugins) {
          expect({ file, description: plugin.description }).toEqual({ file, description: expected })
        }
      }
    }),
  ),
)

test(
  'plugin.json description equals the package description',
  eff(
    Effect.gen(function* () {
      const file = 'plugins/webular/.claude-plugin/plugin.json'
      expect({ file, description: yield* readDescription(file) }).toEqual({
        file,
        description: yield* source,
      })
    }),
  ),
)

test(
  'server.json description is the source, or a prefix ending at a clause break within the registry cap',
  eff(
    Effect.gen(function* () {
      const text = yield* source
      const description = yield* readDescription('server.json')
      const ok =
        description.length <= SERVER_JSON_CAP &&
        (description === text ||
          (text.startsWith(description) &&
            /^(\s+[—–-]|[,.;:])/.test(text.slice(description.length))))
      expect({ file: 'server.json', description, ok }).toEqual({
        file: 'server.json',
        description,
        ok: true,
      })
    }),
  ),
)
