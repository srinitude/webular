// One table and one resolver for "which webular executable fits this machine".
// The CLI launcher, the release packaging, and the parity test all read
// TARGETS, so build targets, release assets, npm package names, and runtime
// picks never drift apart. Detection runs in-process (no child process), once
// per process: the launcher is its only runtime caller.
// Bun ships one x64 binary per OS that picks AVX2/AVX-512 paths at runtime, so
// no -baseline build exists to choose (https://bun.com/docs/bundler/executables).
import { cpus } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, FileSystem, Option } from 'effect'

type Os = 'darwin' | 'linux' | 'win32'
type Cpu = 'arm64' | 'x64'
type Libc = 'glibc' | 'musl'

export interface Target {
  key: string // webular-<key> is the npm package and asset stem; bun-<key> the build target
  os: Os
  cpu: Cpu
  libc?: Libc
}

const t = (os: Os, cpu: Cpu, libc?: Libc): Target => ({
  key: [os === 'win32' ? 'windows' : os, cpu, libc === 'musl' ? 'musl' : '']
    .filter(Boolean)
    .join('-'),
  os,
  cpu,
  libc,
})

export const TARGETS: readonly Target[] = [
  t('darwin', 'arm64'),
  t('darwin', 'x64'),
  t('linux', 'x64', 'glibc'),
  t('linux', 'arm64', 'glibc'),
  t('linux', 'x64', 'musl'),
  t('linux', 'arm64', 'musl'),
  t('win32', 'x64'),
  t('win32', 'arm64'),
]

const exeSuffix = (target: Target): string => (target.os === 'win32' ? '.exe' : '')
export const packageName = (target: Target): string => `webular-${target.key}`
export const bunTarget = (target: Target): string => `bun-${target.key}`
export const exeName = (target: Target): string => `webular${exeSuffix(target)}`
export const assetName = (target: Target): string => `webular-${target.key}${exeSuffix(target)}`

export interface Facts {
  platform: string
  arch: string
  libc?: Libc
  rosetta?: boolean
}

// The build for this machine, or none when it is unsupported.
export function targetFor(facts: Facts): Target | undefined {
  const cpu = facts.rosetta ? 'arm64' : facts.arch
  return TARGETS.find(
    (x) => x.os === facts.platform && x.cpu === cpu && (x.os !== 'linux' || x.libc === facts.libc),
  )
}

// musl systems ship their loader as /lib/ld-musl-<arch>.so.1.
const linuxLibc = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const names = yield* fs.readDirectory('/lib').pipe(Effect.orElseSucceed(() => []))
  return names.some((name) => name.startsWith('ld-musl-')) ? ('musl' as const) : ('glibc' as const)
})

// An x64 process under Rosetta still reads the host brand string ("Apple M…").
const underRosetta = (): boolean =>
  process.platform === 'darwin' &&
  process.arch === 'x64' &&
  (cpus()[0]?.model ?? '').startsWith('Apple')

export const hostFacts = Effect.gen(function* () {
  const libc = process.platform === 'linux' ? yield* linuxLibc : undefined
  return { platform: process.platform, arch: process.arch, libc, rosetta: underRosetta() }
})

// Magic bytes plus the CPU field for each OS: a wrong-OS, wrong-CPU,
// truncated, or corrupt file never matches, so it is never run.
export function headerFits(head: Uint8Array, target: Target): boolean {
  if (head.byteLength < 64) return false
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength)
  const u32 = (at: number) => view.getUint32(at, true)
  if (target.os === 'darwin') {
    return u32(0) === 0xfeedfacf && u32(4) === (target.cpu === 'arm64' ? 0x0100000c : 0x01000007)
  }
  if (target.os === 'linux') {
    return (
      u32(0) === 0x464c457f && view.getUint16(18, true) === (target.cpu === 'arm64' ? 0xb7 : 0x3e)
    )
  }
  const pe = u32(0x3c)
  if (view.getUint16(0, true) !== 0x5a4d || pe + 6 > head.byteLength) return false
  return (
    u32(pe) === 0x4550 &&
    view.getUint16(pe + 4, true) === (target.cpu === 'arm64' ? 0xaa64 : 0x8664)
  )
}

const fits = (path: string, target: Target) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const file = yield* fs.open(path, { flag: 'r' })
    const head = yield* file.readAlloc(4096)
    return Option.isSome(head) && headerFits(head.value, target)
  }).pipe(
    Effect.scoped,
    Effect.orElseSucceed(() => false),
  )

// Install layouts, best first: the optional package nested under webular (npm
// global), hoisted beside it (npm, bun, and pnpm's .pnpm sibling), then a local
// `mise run compile:all` build.
function locations(root: string, target: Target): string[] {
  const pkg = packageName(target)
  return [
    join(root, 'node_modules', pkg, 'bin', exeName(target)),
    join(dirname(root), pkg, 'bin', exeName(target)),
    join(root, 'dist', 'bin', assetName(target)),
  ]
}

// The first location holding a valid native build for these facts, if any.
export const nativeExecutable = (root: string, facts: Facts) =>
  Effect.gen(function* () {
    const target = targetFor(facts)
    if (!target) return Option.none<string>()
    const found = yield* Effect.filter(locations(root, target), (path) => fits(path, target), {
      concurrency: 3,
    })
    return Option.fromNullishOr(found[0])
  })
