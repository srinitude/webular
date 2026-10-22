// Release step (after the SHA256SUMS step): turns dist/bin/SHA256SUMS into a
// Homebrew formula (webular.rb) and a Scoop manifest (webular.json) that point
// at this release's assets, so package managers install the exact checksummed
// binaries. Homebrew covers macOS and glibc Linux; Scoop covers Windows; musl
// Linux installs through install.sh.
import { join } from 'node:path'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Data, Effect, FileSystem, Schema } from 'effect'
import { assetName, TARGETS, type Target } from '../core/platform.ts'
import { PACKAGE_ROOT } from '../core/root.ts'

class MissingChecksum extends Data.TaggedError('MissingChecksum')<{ asset: string }> {}

type Sums = ReadonlyMap<string, string>

export const releaseUrl = (version: string, asset: string): string =>
  `https://github.com/srinitude/webular/releases/download/v${version}/${asset}`

// `sha256sum` lines: "<64 hex>  <name>" (a "*" before the name marks binary mode).
export const parseSums = (text: string): Sums =>
  new Map(
    text
      .split('\n')
      .map((line) => /^([0-9a-f]{64}) [ *](\S+)$/.exec(line.trim()))
      .flatMap((m) => (m?.[1] && m[2] ? [[m[2], m[1]] as const] : [])),
  )

// Package managers ship the default builds; baseline builds ship as npm packages and release assets.
export const brewTargets = TARGETS.filter(
  (x) => x.os !== 'win32' && x.libc !== 'musl' && !x.baseline,
)
export const scoopTargets = TARGETS.filter((x) => x.os === 'win32' && !x.baseline)

export const sumFor = (sums: Sums, target: Target) => {
  const asset = assetName(target)
  const sha = sums.get(asset)
  return sha ? Effect.succeed({ asset, sha }) : Effect.fail(new MissingChecksum({ asset }))
}

const brewBlock = (version: string, sums: Sums, target: Target) =>
  Effect.map(sumFor(sums, target), ({ asset, sha }) =>
    [
      `    on_${target.cpu === 'arm64' ? 'arm' : 'intel'} do`,
      `      url "${releaseUrl(version, asset)}"`,
      `      sha256 "${sha}"`,
      '    end',
    ].join('\n'),
  )

const brewOs = (version: string, sums: Sums, os: 'darwin' | 'linux') =>
  Effect.forEach(
    brewTargets.filter((x) => x.os === os),
    (target) => brewBlock(version, sums, target),
    { concurrency: 4 },
  )

export const homebrewFormula = (version: string, sums: Sums) =>
  Effect.gen(function* () {
    const mac = yield* brewOs(version, sums, 'darwin')
    const linux = yield* brewOs(version, sums, 'linux')
    return [
      'class Webular < Formula',
      '  desc "Universal web research CLI"',
      '  homepage "https://github.com/srinitude/webular"',
      `  version "${version}"`,
      '  license "Apache-2.0"',
      '',
      '  on_macos do',
      ...mac,
      '  end',
      '',
      '  on_linux do',
      ...linux,
      '  end',
      '',
      '  def install',
      '    bin.install Dir["webular-*"].first => "webular"',
      '  end',
      '',
      '  test do',
      '    assert_match version.to_s, shell_output("#{bin}/webular --version")',
      '  end',
      'end',
      '',
    ].join('\n')
  })

const scoopEntry = (version: string, sums: Sums, target: Target) =>
  Effect.map(sumFor(sums, target), ({ asset, sha }) => ({
    url: `${releaseUrl(version, asset)}#/webular.exe`,
    hash: sha,
  }))

export const scoopManifest = (version: string, sums: Sums) =>
  Effect.gen(function* () {
    const entries = yield* Effect.forEach(
      scoopTargets,
      (target) => Effect.map(scoopEntry(version, sums, target), (e) => [target.cpu, e] as const),
      { concurrency: 4 },
    )
    const arch = Object.fromEntries(entries)
    const manifest = {
      version,
      description: 'Universal web research CLI',
      homepage: 'https://github.com/srinitude/webular',
      license: 'Apache-2.0',
      architecture: { '64bit': arch['x64'], arm64: arch['arm64'] },
      bin: 'webular.exe',
    }
    return `${JSON.stringify(manifest, null, 2)}\n`
  })

const Version = Schema.fromJsonString(Schema.Struct({ version: Schema.String }))

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const bin = join(PACKAGE_ROOT, 'dist', 'bin')
  const pkg = yield* fs.readFileString(join(PACKAGE_ROOT, 'package.json'))
  const { version } = yield* Schema.decodeUnknownEffect(Version)(pkg)
  const sums = parseSums(yield* fs.readFileString(join(bin, 'SHA256SUMS')))
  const files = [
    ['webular.rb', yield* homebrewFormula(version, sums)],
    ['webular.json', yield* scoopManifest(version, sums)],
  ] as const
  yield* Effect.forEach(files, ([name, text]) => fs.writeFileString(join(bin, name), text), {
    concurrency: 4,
    discard: true,
  })
})

if (import.meta.main) BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)))
