// winget output: the three manifests carry every field the winget schema
// requires, the right type and schema version, uppercase checksums and release
// URLs for both Windows assets as portable `webular` installers, and a missing
// checksum fails the release instead of shipping a gap.
import { expect, test } from 'bun:test'
import { Effect, Exit } from 'effect'
import { assetName, TARGETS } from '../../src/core/platform.ts'
import { parseSums, releaseUrl } from '../../src/release/distribution.ts'
import { wingetManifests } from '../../src/release/winget.ts'

const VERSION = '9.8.7'
const ID = 'Srinitude.Webular'
const shaOf = (asset: string) =>
  new Bun.CryptoHasher('sha256').update(asset).digest('hex') as string
const SUMS = TARGETS.map((x) => `${shaOf(assetName(x))}  ${assetName(x)}`).join('\n')
const windows = TARGETS.filter((x) => x.os === 'win32' && !x.baseline)

type Doc = Record<string, unknown>
const build = () =>
  Effect.runSync(wingetManifests(VERSION, parseSums(SUMS))).map(
    ([name, text]) => [name, Bun.YAML.parse(text) as Doc] as const,
  )
const doc = (name: string) => build().find(([n]) => n === name)?.[1] ?? {}

const common = (d: Doc, type: string) => {
  expect(d['PackageIdentifier']).toBe(ID)
  expect(String(d['PackageVersion'])).toBe(VERSION)
  expect(d['ManifestType']).toBe(type)
  expect(d['ManifestVersion']).toBe('1.12.0')
}

test('writes exactly the version, installer, and defaultLocale files', () => {
  expect(build().map(([n]) => n)).toEqual([
    `${ID}.yaml`,
    `${ID}.installer.yaml`,
    `${ID}.locale.en-US.yaml`,
  ])
})

test('version manifest names the default locale', () => {
  const d = doc(`${ID}.yaml`)
  common(d, 'version')
  expect(d['DefaultLocale']).toBe('en-US')
})

test('defaultLocale manifest carries every required field', () => {
  const d = doc(`${ID}.locale.en-US.yaml`)
  common(d, 'defaultLocale')
  expect(d).toMatchObject({
    PackageLocale: 'en-US',
    Publisher: 'Srinitude',
    PackageName: 'webular',
    License: 'Apache-2.0',
    ShortDescription: 'Universal web research CLI',
    PackageUrl: 'https://github.com/srinitude/webular',
  })
})

test('installer manifest lists both Windows assets as portable webular', () => {
  const d = doc(`${ID}.installer.yaml`)
  common(d, 'installer')
  expect(d['InstallerType']).toBe('portable')
  expect(d['Commands']).toEqual(['webular'])
  expect(d['Installers']).toEqual(
    windows.map((x) => ({
      Architecture: x.cpu,
      InstallerUrl: releaseUrl(VERSION, assetName(x)),
      InstallerSha256: shaOf(assetName(x)).toUpperCase(),
    })),
  )
  expect(JSON.stringify(d['Installers'])).toMatch(/"InstallerSha256":"[0-9A-F]{64}"/)
})

test('a missing Windows checksum fails instead of shipping a gap', () => {
  const gap = SUMS.split('\n')
    .filter((line) => !line.endsWith('webular-windows-arm64.exe'))
    .join('\n')
  const exit = Effect.runSyncExit(wingetManifests(VERSION, parseSums(gap)))
  expect(Exit.isFailure(exit)).toBe(true)
})
