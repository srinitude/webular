// Arch and Nix output: the PKGBUILD parses under `bash -n` and carries the
// release URLs and checksums of both glibc Linux assets, .SRCINFO agrees with
// it, the Nix derivation lists every brew system with its URL and checksum
// (text only: nix is not needed), a missing checksum fails the release, and
// the static Dockerfile names only real release assets.
import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, Exit, FileSystem } from 'effect'
import { assetName, TARGETS } from '../../src/core/platform.ts'
import { runProc } from '../../src/core/proc.ts'
import { pkgbuild, srcinfo } from '../../src/release/aur.ts'
import { brewTargets, parseSums, releaseUrl } from '../../src/release/distribution.ts'
import { distroFiles } from '../../src/release/distros.ts'
import { nixDerivation } from '../../src/release/nix.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const VERSION = '9.8.7'
const shaOf = (asset: string) =>
  new Bun.CryptoHasher('sha256').update(asset).digest('hex') as string
const SUMS = TARGETS.map((x) => `${shaOf(assetName(x))}  ${assetName(x)}`).join('\n')
const sums = parseSums(SUMS)
const linux = brewTargets.filter((x) => x.os === 'linux')
const CPU = { x64: 'x86_64', arm64: 'aarch64' } as const

const pkg = Effect.runSync(pkgbuild(VERSION, sums))
const info = Effect.runSync(srcinfo(VERSION, sums))
const nix = Effect.runSync(nixDerivation(VERSION, sums))

test(
  'the PKGBUILD passes bash -n and installs to /usr/bin/webular',
  eff(
    Effect.gen(function* () {
      const out = yield* runProc(['bash', '-n'], { stdin: pkg, timeoutMs: 20_000 })
      expect([out.code, out.stderr]).toEqual([0, ''])
      expect(pkg).toContain('pkgver=9.8.7')
      expect(pkg).toContain('"$pkgdir/usr/bin/webular"')
    }),
  ),
)

test('the PKGBUILD and .SRCINFO carry each Linux asset URL and checksum', () => {
  expect(linux.length).toBe(2)
  for (const t of linux) {
    const arch = CPU[t.cpu]
    const src = `webular-${arch}::${releaseUrl(VERSION, assetName(t))}`
    expect(pkg).toContain(`source_${arch}=('${src}')`)
    expect(pkg).toContain(`sha256sums_${arch}=('${shaOf(assetName(t))}')`)
    expect(info).toContain(`\tsource_${arch} = ${src}`)
    expect(info).toContain(`\tsha256sums_${arch} = ${shaOf(assetName(t))}`)
  }
  expect(info.startsWith('pkgbase = webular-bin\n')).toBe(true)
  expect(info).toContain('\npkgname = webular-bin\n')
})

test('a prerelease version keeps hyphens out of pkgver but in the URLs', () => {
  const text = Effect.runSync(pkgbuild('1.0.0-rc.1', sums))
  expect(text).toContain('pkgver=1.0.0_rc.1')
  expect(text).toContain('/download/v1.0.0-rc.1/')
})

test('the Nix derivation lists every system with its URL and checksum', () => {
  expect(brewTargets.length).toBe(4)
  for (const t of brewTargets) {
    const block = nix.slice(nix.indexOf(`${CPU[t.cpu]}-${t.os} = {`))
    expect(block).toContain(`url = "${releaseUrl(VERSION, assetName(t))}";`)
    expect(block).toContain(`sha256 = "${shaOf(assetName(t))}";`)
  }
  expect(nix).toContain('version = "9.8.7";')
  expect(nix).toContain('install -Dm755 $src $out/bin/webular')
})

test('distroFiles names the three files and a missing checksum fails', () => {
  const files = Effect.runSync(distroFiles(VERSION, sums)).map(([name]) => name)
  expect(files).toEqual(['PKGBUILD', '.SRCINFO', 'webular.nix'])
  const kept = SUMS.split('\n').filter((l) => !l.endsWith('webular-linux-arm64'))
  const exit = Effect.runSyncExit(distroFiles(VERSION, parseSums(kept.join('\n'))))
  expect(Exit.isFailure(exit)).toBe(true)
})

test(
  'the Dockerfile names only real release assets and runs webular',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(join(ROOT, 'Dockerfile'))
      const named = text.match(/webular-(?:linux|darwin|windows)-[a-z0-9-]*[a-z0-9]/g) ?? []
      const assets = new Set(TARGETS.map(assetName))
      expect(named.length).toBeGreaterThan(0)
      for (const n of named) expect(assets.has(n)).toBe(true)
      for (const t of TARGETS.filter((x) => x.os === 'linux' && x.libc === 'musl' && !x.baseline))
        expect(named).toContain(assetName(t))
      expect(text).toContain('ARG TARGETARCH')
      expect(text).toContain('ENTRYPOINT ["webular"]')
    }),
  ),
)
