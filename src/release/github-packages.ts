// Release step (after `mise run package:platforms`): turns the npm packages it
// wrote into GitHub Packages ones. GitHub Packages takes only scoped names, so
// the root package.json and every npm/webular-<key>/package.json get the name
// @srinitude/<name> and publishConfig.registry set to npm.pkg.github.com. The
// root's platform optionalDependencies become npm aliases
// (webular-<key> -> npm:@srinitude/webular-<key>@<version>), so npm still
// installs each one under node_modules/webular-<key>, where the Node launcher
// looks for it. Run only in the publish-github-packages job: it rewrites the
// files the npmjs.com publish reads.
import { join } from 'node:path'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { packageName, TARGETS } from '../core/platform.ts'
import { PACKAGE_ROOT } from '../core/root.ts'

export const SCOPE = '@srinitude'
export const GITHUB_REGISTRY = 'https://npm.pkg.github.com'

const PLATFORM_NAMES = new Set(TARGETS.map(packageName))

const Manifest = Schema.fromJsonString(
  Schema.StructWithRest(
    Schema.Struct({
      name: Schema.String,
      version: Schema.String,
      publishConfig: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
      optionalDependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
)
type Manifest = typeof Manifest.Type

// Platform packages become aliases to their scoped copies; other entries stay.
const aliasPlatforms = (deps: Readonly<Record<string, string>>) =>
  Object.fromEntries(
    Object.entries(deps).map(([name, version]) =>
      PLATFORM_NAMES.has(name) ? [name, `npm:${SCOPE}/${name}@${version}`] : [name, version],
    ),
  )

const scopeManifest = (pkg: Manifest): Manifest => ({
  ...pkg,
  name: `${SCOPE}/${pkg.name}`,
  publishConfig: { ...pkg.publishConfig, registry: GITHUB_REGISTRY },
  ...(pkg.optionalDependencies
    ? { optionalDependencies: aliasPlatforms(pkg.optionalDependencies) }
    : {}),
})

// The root package.json and one per target, as package:platforms lays them out.
export const manifestPaths = (root: string) => [
  join(root, 'package.json'),
  ...TARGETS.map((target) => join(root, 'npm', packageName(target), 'package.json')),
]

const rewrite = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const pkg = yield* Schema.decodeUnknownEffect(Manifest)(yield* fs.readFileString(path))
    yield* fs.writeFileString(path, `${JSON.stringify(scopeManifest(pkg), null, 2)}\n`)
  })

export const scopeForGitHub = (root: string) =>
  Effect.forEach(manifestPaths(root), rewrite, { concurrency: 4, discard: true })

if (import.meta.main)
  BunRuntime.runMain(scopeForGitHub(PACKAGE_ROOT).pipe(Effect.provide(BunServices.layer)))
