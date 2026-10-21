// Release step (after the SHA256SUMS step): turns the version and SHA256SUMS
// into an Arch User Repository package, `webular-bin`: a PKGBUILD and its
// .SRCINFO that point at this release's glibc Linux assets. Each source is
// renamed webular-<arch> so package() installs "$srcdir/webular-$CARCH".
// Pushing to the AUR stays a manual step.
import { Effect } from 'effect'
import { brewTargets, releaseUrl, sumFor } from './distribution.ts'

const URL = 'https://github.com/srinitude/webular'
const DESC = 'Universal web research CLI'
const AUR_ARCH = { x64: 'x86_64', arm64: 'aarch64' } as const

const linux = brewTargets.filter((x) => x.os === 'linux')

// pkgver may not hold a hyphen; the source URLs keep the real tag.
const pkgver = (version: string): string => version.replaceAll('-', '_')

const sources = (version: string, sums: ReadonlyMap<string, string>) =>
  Effect.forEach(
    linux,
    (target) =>
      Effect.map(sumFor(sums, target), ({ asset, sha }) => {
        const arch = AUR_ARCH[target.cpu]
        return { arch, source: `webular-${arch}::${releaseUrl(version, asset)}`, sha }
      }),
    { concurrency: 2 },
  )

export const pkgbuild = (version: string, sums: ReadonlyMap<string, string>) =>
  Effect.map(sources(version, sums), (srcs) =>
    [
      'pkgname=webular-bin',
      `pkgver=${pkgver(version)}`,
      'pkgrel=1',
      `pkgdesc='${DESC}'`,
      `arch=(${srcs.map((s) => `'${s.arch}'`).join(' ')})`,
      `url='${URL}'`,
      "license=('Apache-2.0')",
      "provides=('webular')",
      "conflicts=('webular')",
      // Stripping would cut the script payload Bun appends to its executable.
      "options=('!strip')",
      ...srcs.flatMap((s) => [
        `source_${s.arch}=('${s.source}')`,
        `sha256sums_${s.arch}=('${s.sha}')`,
      ]),
      '',
      'package() {',
      '  install -Dm755 "$srcdir/webular-$CARCH" "$pkgdir/usr/bin/webular"',
      '}',
      '',
    ].join('\n'),
  )

export const srcinfo = (version: string, sums: ReadonlyMap<string, string>) =>
  Effect.map(sources(version, sums), (srcs) =>
    [
      'pkgbase = webular-bin',
      `\tpkgdesc = ${DESC}`,
      `\tpkgver = ${pkgver(version)}`,
      '\tpkgrel = 1',
      `\turl = ${URL}`,
      ...srcs.map((s) => `\tarch = ${s.arch}`),
      '\tlicense = Apache-2.0',
      '\toptions = !strip',
      '\tprovides = webular',
      '\tconflicts = webular',
      ...srcs.flatMap((s) => [
        `\tsource_${s.arch} = ${s.source}`,
        `\tsha256sums_${s.arch} = ${s.sha}`,
      ]),
      '',
      'pkgname = webular-bin',
      '',
    ].join('\n'),
  )
