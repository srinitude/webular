// Release step (after `mise run compile:all`): one npm package per TARGETS
// entry, named webular-<key>, carrying only its binary and the os/cpu/libc
// fields npm, bun, and pnpm use to install just the one that fits. The root
// package lists them all as exact-version optionalDependencies, so an install
// needs no postinstall download. Writes npm/<package>/ and package.json.
import { join } from 'node:path'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { assetName, exeName, packageName, TARGETS, type Target } from '../core/platform.ts'
import { PACKAGE_ROOT } from '../core/root.ts'

const platformManifest = (target: Target, version: string) => ({
  name: packageName(target),
  version,
  description: `webular executable for ${target.key}`,
  license: 'Apache-2.0',
  repository: { type: 'git', url: 'git+https://github.com/srinitude/webular.git' },
  os: [target.os],
  cpu: [target.cpu],
  ...(target.libc ? { libc: [target.libc] } : {}),
  files: ['bin'],
  preferUnplugged: true,
})

const writePackage = (target: Target, version: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = join(PACKAGE_ROOT, 'npm', packageName(target))
    const exe = join(dir, 'bin', exeName(target))
    yield* fs.makeDirectory(join(dir, 'bin'), { recursive: true })
    yield* fs.copyFile(join(PACKAGE_ROOT, 'dist', 'bin', assetName(target)), exe)
    if (target.os !== 'win32') yield* fs.chmod(exe, 0o755)
    const manifest = `${JSON.stringify(platformManifest(target, version), null, 2)}\n`
    yield* fs.writeFileString(join(dir, 'package.json'), manifest)
  })

const RootManifest = Schema.fromJsonString(
  Schema.Struct({
    version: Schema.String,
    optionalDependencies: Schema.Record(Schema.String, Schema.String),
  }),
)
const AnyManifest = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = join(PACKAGE_ROOT, 'package.json')
  const text = yield* fs.readFileString(path)
  const { version, optionalDependencies } = yield* Schema.decodeUnknownEffect(RootManifest)(text)
  const pkg = yield* Schema.decodeUnknownEffect(AnyManifest)(text)
  yield* Effect.forEach(TARGETS, (target) => writePackage(target, version), {
    concurrency: 4,
    discard: true,
  })
  const platforms = Object.fromEntries(TARGETS.map((target) => [packageName(target), version]))
  const next = { ...pkg, optionalDependencies: { ...optionalDependencies, ...platforms } }
  yield* fs.writeFileString(path, `${JSON.stringify(next, null, 2)}\n`)
})

if (import.meta.main) BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)))
