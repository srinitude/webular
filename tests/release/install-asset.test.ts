// scripts/install.sh picks the exact Bun compile target asset for every
// OS, CPU, libc, and AVX2 combination, Rosetta and Windows shells included.
// WEBULAR_PRINT_ASSET=1 prints the name and stops before any download.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const OSES = ['Darwin', 'Linux'] as const
const ARCHES = ['x86_64', 'amd64', 'arm64', 'aarch64'] as const
const LIBCS = ['glibc', 'musl'] as const
const BASELINES = ['0', '1'] as const // WEBULAR_BASELINE=1 stands for a CPU without AVX2

// musl exists only on Linux; baseline only on x64.
const expected = (os: string, arch: string, libc: string, baseline: string) => {
  const cpu = arch === 'x86_64' || arch === 'amd64' ? 'x64' : 'arm64'
  const musl = os === 'Linux' && libc === 'musl' ? '-musl' : ''
  const noAvx2 = cpu === 'x64' && baseline === '1' ? '-baseline' : ''
  return `webular-${os.toLowerCase()}-${cpu}${musl}${noAvx2}`
}

const cases = OSES.flatMap((os) =>
  ARCHES.flatMap((arch) =>
    LIBCS.flatMap((libc) => BASELINES.map((baseline) => ({ os, arch, libc, baseline }))),
  ),
)

const printAsset = (env: Record<string, string>) =>
  runProc(['sh', `${ROOT}scripts/install.sh`], {
    env: { ...env, WEBULAR_PRINT_ASSET: '1' },
    extendEnv: true,
    timeoutMs: 10_000,
  })

const posixOnly = test.skipIf(process.platform === 'win32')

posixOnly(
  'install.sh picks the right asset for every target combination',
  eff(
    Effect.gen(function* () {
      expect(cases).toHaveLength(32)
      const got = yield* Effect.forEach(
        cases,
        (c) =>
          printAsset({
            WEBULAR_OS: c.os,
            WEBULAR_ARCH: c.arch,
            WEBULAR_LIBC: c.libc,
            WEBULAR_BASELINE: c.baseline,
          }),
        { concurrency: 4 },
      )
      expect(got.map((r) => [r.code, r.stdout.trim()])).toEqual(
        cases.map((c) => [0, expected(c.os, c.arch, c.libc, c.baseline)]),
      )
    }),
  ),
)

posixOnly(
  'install.sh sends Windows shells to install.ps1 and names unsupported CPUs',
  eff(
    Effect.gen(function* () {
      const win = yield* printAsset({ WEBULAR_OS: 'MINGW64_NT-10.0', WEBULAR_ARCH: 'x86_64' })
      expect(win.stderr).toContain('install.ps1')
      const cpu = yield* printAsset({ WEBULAR_OS: 'Linux', WEBULAR_ARCH: 'riscv64' })
      expect(cpu.stderr).toContain('webular ships x64 and arm64 builds')
    }),
  ),
)
