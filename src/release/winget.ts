// Release step (after the SHA256SUMS step): turns dist/bin/SHA256SUMS into a
// winget manifest set (version, installer, defaultLocale) in dist/bin/winget,
// pointing at this release's Windows assets as portable installers. The
// release uploads the folder as a build artifact; submitting it to
// microsoft/winget-pkgs stays a manual step. ManifestVersion matches what
// winget-pkgs merges (https://github.com/microsoft/winget-cli/tree/master/schemas/JSON/manifests).
import { join } from 'node:path'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { PACKAGE_ROOT } from '../core/root.ts'
import { parseSums, releaseUrl, scoopTargets, sumFor } from './distribution.ts'

export const WINGET_ID = 'Srinitude.Webular'
const MANIFEST_VERSION = '1.12.0'

// Every manifest opens with the schema hint and the package identity, and ends
// with its type and schema version.
const manifest = (type: string, version: string, body: readonly string[]): string =>
  [
    `# yaml-language-server: $schema=https://aka.ms/winget-manifest.${type}.${MANIFEST_VERSION}.schema.json`,
    '',
    `PackageIdentifier: ${WINGET_ID}`,
    `PackageVersion: ${version}`,
    ...body,
    `ManifestType: ${type}`,
    `ManifestVersion: ${MANIFEST_VERSION}`,
    '',
  ].join('\n')

const installerEntries = (version: string, sums: ReadonlyMap<string, string>) =>
  Effect.forEach(
    scoopTargets,
    (target) =>
      Effect.map(sumFor(sums, target), ({ asset, sha }) => [
        `- Architecture: ${target.cpu}`,
        `  InstallerUrl: ${releaseUrl(version, asset)}`,
        `  InstallerSha256: ${sha.toUpperCase()}`,
      ]),
    { concurrency: 2 },
  )

// [file name, YAML text] for the three files of a multi-file winget manifest.
export const wingetManifests = (version: string, sums: ReadonlyMap<string, string>) =>
  Effect.map(installerEntries(version, sums), (entries) => [
    [`${WINGET_ID}.yaml`, manifest('version', version, ['DefaultLocale: en-US'])] as const,
    [
      `${WINGET_ID}.installer.yaml`,
      manifest('installer', version, [
        'InstallerType: portable',
        'Commands:',
        '- webular',
        'Installers:',
        ...entries.flat(),
      ]),
    ] as const,
    [
      `${WINGET_ID}.locale.en-US.yaml`,
      manifest('defaultLocale', version, [
        'PackageLocale: en-US',
        'Publisher: Srinitude',
        'PackageName: webular',
        'PackageUrl: https://github.com/srinitude/webular',
        'License: Apache-2.0',
        'ShortDescription: Universal web research CLI',
      ]),
    ] as const,
  ])

const Version = Schema.fromJsonString(Schema.Struct({ version: Schema.String }))

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const bin = join(PACKAGE_ROOT, 'dist', 'bin')
  const pkg = yield* fs.readFileString(join(PACKAGE_ROOT, 'package.json'))
  const { version } = yield* Schema.decodeUnknownEffect(Version)(pkg)
  const sums = parseSums(yield* fs.readFileString(join(bin, 'SHA256SUMS')))
  const files = yield* wingetManifests(version, sums)
  yield* fs.makeDirectory(join(bin, 'winget'), { recursive: true })
  yield* Effect.forEach(
    files,
    ([name, text]) => fs.writeFileString(join(bin, 'winget', name), text),
    { concurrency: 3, discard: true },
  )
})

if (import.meta.main) BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)))
