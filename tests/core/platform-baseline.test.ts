// Baseline contract: every x64 target has a -baseline sibling (arm64 has none),
// and the platform-to-asset table covers every OS x arch x libc x avx2 combination.
import { expect, test } from 'bun:test'
import { assetName, bunTarget, packageName, TARGETS, targetFor } from '../../src/core/platform.ts'

const BASELINE_KEYS = [
  'darwin-x64-baseline',
  'linux-x64-baseline',
  'linux-x64-musl-baseline',
  'windows-x64-baseline',
]

test('the four x64 baseline targets exist, with bun targets and asset names', () => {
  for (const key of BASELINE_KEYS) {
    const target = TARGETS.find((x) => x.key === key)
    expect(target?.baseline).toBe(true)
    expect(target?.cpu).toBe('x64')
    expect(bunTarget(target as never)).toBe(`bun-${key}`)
    expect(packageName(target as never)).toBe(`webular-${key}`)
  }
  expect(assetName(TARGETS.find((x) => x.key === 'windows-x64-baseline') as never)).toBe(
    'webular-windows-x64-baseline.exe',
  )
  expect(TARGETS.filter((x) => x.baseline).map((x) => x.key)).toEqual(BASELINE_KEYS)
  expect(TARGETS.filter((x) => x.cpu === 'arm64' && x.baseline)).toEqual([])
})

const OSES = ['darwin', 'linux', 'win32', 'freebsd'] as const
const ARCHES = ['x64', 'arm64', 'ia32'] as const
const LIBCS = ['glibc', 'musl', undefined] as const
const AVX2 = [true, false, undefined] as const

// Independent oracle: the asset name each machine should get, built from the facts alone.
const expected = (
  os: string,
  arch: string,
  libc: string | undefined,
  avx2: boolean | undefined,
) => {
  if (!['darwin', 'linux', 'win32'].includes(os) || !['x64', 'arm64'].includes(arch))
    return undefined
  if (os === 'linux' && !libc) return undefined
  const parts = [
    os === 'win32' ? 'windows' : os,
    arch,
    os === 'linux' && libc === 'musl' ? 'musl' : '',
    arch === 'x64' && avx2 === false ? 'baseline' : '',
  ].filter(Boolean)
  return `webular-${parts.join('-')}${os === 'win32' ? '.exe' : ''}`
}

const combos = OSES.flatMap((os) =>
  ARCHES.flatMap((arch) => LIBCS.flatMap((libc) => AVX2.map((avx2) => ({ os, arch, libc, avx2 })))),
)

test('every OS x arch x libc x avx2 combination maps to its asset or to none', () => {
  expect(combos).toHaveLength(OSES.length * ARCHES.length * LIBCS.length * AVX2.length)
  for (const { os, arch, libc, avx2 } of combos) {
    const target = targetFor({ platform: os, arch, libc, avx2 })
    const got = [os, arch, libc, avx2, target && assetName(target)]
    expect(got).toEqual([os, arch, libc, avx2, expected(os, arch, libc, avx2)])
  }
})

test('Rosetta ignores avx2 and takes arm64; unknown avx2 takes the default build', () => {
  expect(targetFor({ platform: 'darwin', arch: 'x64', rosetta: true, avx2: false })?.key).toBe(
    'darwin-arm64',
  )
  expect(targetFor({ platform: 'win32', arch: 'x64' })?.key).toBe('windows-x64')
})
