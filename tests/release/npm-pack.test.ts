// The npm channel: build every platform package from placeholder binaries into
// a temp root, then `npm pack --dry-run` each one. Every tarball must hold its
// binary, LICENSE, README.md, and package.json, with os/cpu set, and the root
// package must list exactly these packages as optionalDependencies.
import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem, Schema } from 'effect'
import { assetName, exeName, packageName, TARGETS, type Target } from '../../src/core/platform.ts'
import { runProc } from '../../src/core/proc.ts'
import { platformDependencies, writePackage } from '../../src/release/platform-packages.ts'
import { eff, tmpDir } from '../_support/run.ts'

const Packed = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ files: Schema.Array(Schema.Struct({ path: Schema.String })) })),
)
const Manifest = Schema.fromJsonString(
  Schema.Struct({ os: Schema.Array(Schema.String), cpu: Schema.Array(Schema.String) }),
)

const packedFiles = (dir: string) =>
  runProc(['npm', 'pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: dir,
    timeoutMs: 30_000,
  }).pipe(
    Effect.flatMap((out) => Schema.decodeUnknownEffect(Packed)(out.stdout)),
    Effect.map(([packed]) => (packed?.files ?? []).map((file) => file.path).sort()),
  )

const checkPackage = (root: string, target: Target) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.writeFileString(join(root, 'dist', 'bin', assetName(target)), 'binary')
    yield* writePackage(root, target, '1.2.3')
    const dir = join(root, 'npm', packageName(target))
    const expected = [`bin/${exeName(target)}`, 'LICENSE', 'README.md', 'package.json']
    expect(yield* packedFiles(dir)).toEqual(expected.sort())
    const manifest = yield* Schema.decodeUnknownEffect(Manifest)(
      yield* fs.readFileString(join(dir, 'package.json')),
    )
    expect([manifest.os, manifest.cpu]).toEqual([[target.os], [target.cpu]])
  })

test(
  'each platform package packs its binary, LICENSE, README, and manifest',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const root = yield* tmpDir('webular-npm-')
      yield* fs.makeDirectory(join(root, 'dist', 'bin'), { recursive: true })
      yield* fs.writeFileString(join(root, 'LICENSE'), 'license')
      yield* Effect.forEach(TARGETS, (target) => checkPackage(root, target), {
        concurrency: 4,
        discard: true,
      })
    }),
  ),
  60_000,
)

test('the root package lists exactly the 8 platform packages', () => {
  const names = Object.keys(platformDependencies('1.2.3')).sort()
  expect(names).toHaveLength(8)
  expect(names).toEqual(TARGETS.map(packageName).sort())
})
