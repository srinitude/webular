// One table and one resolver for "which webular executable fits this machine".
// The CLI launcher, the release packaging, and the parity test all read
// TARGETS, so build targets, release assets, npm package names, and runtime
// picks never drift apart. Detection runs in-process, once per process: the
// launcher is its only runtime caller.
// Every x64 target has a -baseline sibling built for CPUs without AVX2
// (https://bun.com/docs/bundler/executables); arm64 has none. The picker takes
// the baseline build only when the host reports no AVX2 or WEBULAR_BASELINE=1.
import { cpus } from 'node:os'
import { dirname, join } from 'node:path'
import { Config, Effect, FileSystem, Option } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'

type Os = 'darwin' | 'linux' | 'win32'
type Cpu = 'arm64' | 'x64'
type Libc = 'glibc' | 'musl'

export interface Target {
  key: string // webular-<key> is the npm package and asset stem; bun-<key> the build target
  os: Os
  cpu: Cpu
  libc?: Libc | undefined
  baseline?: boolean | undefined // x64 build for CPUs without AVX2
}

const t = (os: Os, cpu: Cpu, libc?: Libc, baseline = false): Target => ({
  key: [
    os === 'win32' ? 'windows' : os,
    cpu,
    libc === 'musl' ? 'musl' : '',
    baseline ? 'baseline' : '',
  ]
    .filter(Boolean)
    .join('-'),
  os,
  cpu,
  libc,
  baseline,
})

// Each x64 entry is followed by its baseline sibling.
const withBaseline = (targets: readonly Target[]): Target[] =>
  targets.flatMap((x) => (x.cpu === 'x64' ? [x, t(x.os, x.cpu, x.libc, true)] : [x]))

export const TARGETS: readonly Target[] = withBaseline([
  t('darwin', 'arm64'),
  t('darwin', 'x64'),
  t('linux', 'x64', 'glibc'),
  t('linux', 'arm64', 'glibc'),
  t('linux', 'x64', 'musl'),
  t('linux', 'arm64', 'musl'),
  t('win32', 'x64'),
  t('win32', 'arm64'),
])

const exeSuffix = (target: Target): string => (target.os === 'win32' ? '.exe' : '')
export const packageName = (target: Target): string => `webular-${target.key}`
export const bunTarget = (target: Target): string => `bun-${target.key}`
export const exeName = (target: Target): string => `webular${exeSuffix(target)}`
export const assetName = (target: Target): string => `webular-${target.key}${exeSuffix(target)}`

export interface Facts {
  platform: string
  arch: string
  libc?: Libc | undefined
  rosetta?: boolean
  // false = no AVX2, so x64 takes the baseline build; unknown counts as AVX2.
  avx2?: boolean | undefined
}

// The build for this machine, or none when it is unsupported.
export function targetFor(facts: Facts): Target | undefined {
  const cpu = facts.rosetta ? 'arm64' : facts.arch
  const baseline = cpu === 'x64' && facts.avx2 === false
  return TARGETS.find(
    (x) =>
      x.os === facts.platform &&
      x.cpu === cpu &&
      Boolean(x.baseline) === baseline &&
      (x.os !== 'linux' || x.libc === facts.libc),
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

// Linux lists CPU flags in /proc/cpuinfo; macOS lists leaf-7 features in sysctl.
// Windows is assumed to have AVX2. A source that cannot be read, or a missing
// process spawner (the plain-Node launcher has none), is "unknown" (undefined).
const linuxAvx2 = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const info = yield* fs.readFileString('/proc/cpuinfo').pipe(Effect.option)
  const text = Option.getOrElse(info, () => '')
  return /^flags\s*:/im.test(text) ? /^flags\s*:.*\bavx2\b/im.test(text) : undefined
})

const darwinAvx2 = Effect.gen(function* () {
  const spawner = yield* Effect.serviceOption(ChildProcessSpawner.ChildProcessSpawner)
  if (Option.isNone(spawner)) return undefined
  const sysctl = ChildProcess.make('sysctl', ['-n', 'machdep.cpu.leaf7_features'])
  const run = spawner.value.lines(sysctl).pipe(Effect.timeoutOption('2 seconds'), Effect.option)
  const lines = Option.flatten(yield* run)
  const text = Option.isSome(lines) ? lines.value.join(' ') : ''
  return text.trim() ? /\bAVX2\b/.test(text) : undefined
})

// WEBULAR_BASELINE=1 forces the baseline build on any OS. Only x64 hosts are probed.
const hostAvx2 = Effect.gen(function* () {
  const forced = yield* Config.String('WEBULAR_BASELINE').pipe(Config.withDefault(''))
  if (forced === '1') return false
  if (process.arch !== 'x64') return undefined
  if (process.platform === 'linux') return yield* linuxAvx2
  return process.platform === 'darwin' ? yield* darwinAvx2 : undefined
})

export const hostFacts = Effect.gen(function* () {
  const libc = process.platform === 'linux' ? yield* linuxLibc : undefined
  const rosetta = underRosetta()
  const avx2 = rosetta ? undefined : yield* hostAvx2
  return { platform: process.platform, arch: process.arch, libc, rosetta, avx2 }
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
