// Distribution parity and output: every TARGETS entry has an npm package, a
// release asset, a SHA256SUMS line, and a Homebrew, Scoop, or install.sh path;
// the generated formula and manifest carry the right URL and checksum per
// target, and a missing checksum fails the release instead of shipping a gap.
import { afterAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, ManagedRuntime, Schema } from 'effect'
import release from '../../.github/workflows/release.yml'
import { assetName, exeName, packageName, TARGETS } from '../../src/core/platform.ts'
import {
  brewTargets,
  homebrewFormula,
  parseSums,
  releaseUrl,
  scoopManifest,
  scoopTargets,
} from '../../src/release/distribution.ts'
import { packageCopies } from '../../src/release/platform-packages.ts'
import { ROOT } from '../_support/root.ts'

const runtime = ManagedRuntime.make(BunServices.layer)
afterAll(() => runtime.dispose())

const VERSION = '9.8.7'
const shaOf = (asset: string) =>
  new Bun.CryptoHasher('sha256').update(asset).digest('hex') as string
// The exact `sha256sum webular-*` output shape the release workflow writes.
const SUMS = TARGETS.map((x) => `${shaOf(assetName(x))}  ${assetName(x)}`).join('\n')
const sums = parseSums(SUMS)

const Entry = Schema.Struct({ url: Schema.String, hash: Schema.String })
const Manifest = Schema.fromJsonString(
  Schema.Struct({
    version: Schema.String,
    bin: Schema.String,
    architecture: Schema.Struct({ '64bit': Entry, arm64: Entry }),
  }),
)

test('every target has a package, an asset, a checksum line, and an install path', () =>
  runtime.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const installer = yield* fs.readFileString(`${ROOT}scripts/install.sh`)
      const formula = yield* homebrewFormula(VERSION, sums)
      const manifest = yield* scoopManifest(VERSION, sums)
      for (const target of TARGETS) {
        const asset = assetName(target)
        expect(packageName(target)).toBe(`webular-${target.key}`)
        expect(sums.get(asset)).toBe(shaOf(asset))
        const viaManager = formula.includes(asset) || manifest.includes(asset)
        const viaInstaller = target.libc === 'musl' && installer.includes('suffix=-musl')
        expect([asset, viaManager || viaInstaller]).toEqual([asset, true])
      }
      expect(brewTargets.length + scoopTargets.length).toBe(
        TARGETS.filter((x) => x.libc !== 'musl').length,
      )
    }),
  ))

test('the Homebrew formula pins each macOS and Linux asset by sha256', () =>
  runtime.runPromise(
    Effect.map(homebrewFormula(VERSION, sums), (formula) => {
      expect(formula).toContain(`version "${VERSION}"`)
      expect(formula).toContain('on_macos do')
      expect(formula).toContain('on_linux do')
      for (const target of brewTargets) {
        const asset = assetName(target)
        expect(formula).toContain(
          `url "${releaseUrl(VERSION, asset)}"\n      sha256 "${shaOf(asset)}"`,
        )
      }
      expect(formula.match(/def install/g)?.length).toBe(1)
    }),
  ))

test('the Scoop manifest maps 64bit and arm64 to the Windows assets', () =>
  runtime.runPromise(
    Effect.gen(function* () {
      const text = yield* scoopManifest(VERSION, sums)
      const manifest = yield* Schema.decodeUnknownEffect(Manifest)(text)
      expect(manifest.version).toBe(VERSION)
      expect(manifest.bin).toBe('webular.exe')
      expect(manifest.architecture['64bit']).toEqual({
        url: `${releaseUrl(VERSION, 'webular-windows-x64.exe')}#/webular.exe`,
        hash: shaOf('webular-windows-x64.exe'),
      })
      expect(manifest.architecture.arm64.hash).toBe(shaOf('webular-windows-arm64.exe'))
    }),
  ))

test('a missing checksum fails generation', () =>
  runtime.runPromise(
    Effect.gen(function* () {
      const [first] = TARGETS
      const partial = parseSums(SUMS.split('\n').slice(1).join('\n'))
      const error = yield* Effect.flip(homebrewFormula(VERSION, partial))
      expect(error).toMatchObject({
        _tag: 'MissingChecksum',
        asset: first ? assetName(first) : '',
      })
    }),
  ))

test('release attests, drafts, publishes npm, then un-drafts', () => {
  const text = JSON.stringify(release)
  const order = [
    'mise run compile:all',
    'SHA256SUMS',
    'mise run package:manifests',
    'actions/attest@',
    '--draft',
    'npm/webular-*',
    'publish .',
    '--draft=false',
  ].map((needle) => text.indexOf(needle))
  expect(order.every((at) => at >= 0)).toBe(true)
  expect([...order].sort((a, b) => a - b)).toEqual(order)
  expect(text).toContain('--tag \\"$DIST_TAG\\"')
  expect(text).toContain('--provenance')
  expect(text).toContain('"attestations":"write"')
})

test('every platform package ships the Apache-2.0 LICENSE beside its binary', () => {
  for (const target of TARGETS) {
    const copies = packageCopies('/r', target)
    const dir = join('/r', 'npm', packageName(target))
    expect(copies).toContainEqual([join('/r', 'LICENSE'), join(dir, 'LICENSE')])
    expect(copies).toContainEqual([
      join('/r', 'dist', 'bin', assetName(target)),
      join(dir, 'bin', exeName(target)),
    ])
  }
})
