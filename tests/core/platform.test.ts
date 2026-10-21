// Resolver contract: every supported machine maps to the build made for its OS
// and CPU, a wrong or corrupt file is never picked, and an unsupported machine
// gets no native pick (the launcher then falls back to Bun).
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { BunFileSystem } from '@effect/platform-bun'
import { Effect, FileSystem, Option, type Scope } from 'effect'
import {
  assetName,
  type Facts,
  headerFits,
  nativeExecutable,
  packageName,
  TARGETS,
  type Target,
  targetFor,
} from '../../src/core/platform.ts'

describe('targetFor', () => {
  const cases: [string, Facts, string | undefined][] = [
    ['macOS arm64', { platform: 'darwin', arch: 'arm64' }, 'darwin-arm64'],
    ['macOS x64', { platform: 'darwin', arch: 'x64' }, 'darwin-x64'],
    ['Rosetta prefers arm64', { platform: 'darwin', arch: 'x64', rosetta: true }, 'darwin-arm64'],
    ['Linux x64 glibc', { platform: 'linux', arch: 'x64', libc: 'glibc' }, 'linux-x64'],
    ['Linux x64 musl', { platform: 'linux', arch: 'x64', libc: 'musl' }, 'linux-x64-musl'],
    ['Linux arm64 glibc', { platform: 'linux', arch: 'arm64', libc: 'glibc' }, 'linux-arm64'],
    ['Linux arm64 musl', { platform: 'linux', arch: 'arm64', libc: 'musl' }, 'linux-arm64-musl'],
    ['Windows x64', { platform: 'win32', arch: 'x64' }, 'windows-x64'],
    ['Windows arm64', { platform: 'win32', arch: 'arm64' }, 'windows-arm64'],
    ['FreeBSD is unsupported', { platform: 'freebsd', arch: 'x64' }, undefined],
    ['Linux ia32 is unsupported', { platform: 'linux', arch: 'ia32', libc: 'glibc' }, undefined],
    ['Linux with unknown libc is unsupported', { platform: 'linux', arch: 'x64' }, undefined],
  ]
  for (const [name, facts, want] of cases)
    test(name, () => expect(targetFor(facts)?.key).toBe(want))
})

test('names: .exe only on Windows, package matches asset stem', () => {
  for (const x of TARGETS) {
    expect(assetName(x)).toBe(`webular-${x.key}${x.os === 'win32' ? '.exe' : ''}`)
    expect(packageName(x)).toBe(`webular-${x.key}`)
  }
})

const header = (words: [number, number][]) => {
  const head = new Uint8Array(4096)
  const view = new DataView(head.buffer)
  for (const [at, value] of words) view.setUint32(at, value, true)
  return head
}
const machOArm64 = header([
  [0, 0xfeedfacf],
  [4, 0x0100000c],
])
const elfX64 = header([
  [0, 0x464c457f],
  [16, 0x003e0002],
])
const peArm64 = header([
  [0, 0x5a4d],
  [0x3c, 0x80],
  [0x80, 0x4550],
  [0x84, 0xaa64],
])
const target = (key: string) => TARGETS.find((x) => x.key === key) as Target

describe('headerFits', () => {
  test('Mach-O arm64 fits darwin-arm64 only', () => {
    expect(headerFits(machOArm64, target('darwin-arm64'))).toBe(true)
    expect(headerFits(machOArm64, target('darwin-x64'))).toBe(false)
    expect(headerFits(machOArm64, target('linux-arm64'))).toBe(false)
  })
  test('ELF x86-64 fits linux-x64 only', () => {
    expect(headerFits(elfX64, target('linux-x64'))).toBe(true)
    expect(headerFits(elfX64, target('linux-arm64'))).toBe(false)
  })
  test('PE arm64 fits windows-arm64 only', () => {
    expect(headerFits(peArm64, target('windows-arm64'))).toBe(true)
    expect(headerFits(peArm64, target('windows-x64'))).toBe(false)
  })
  test('truncated or garbage never fits', () => {
    expect(headerFits(new Uint8Array(8), target('darwin-arm64'))).toBe(false)
    expect(headerFits(new Uint8Array(4096).fill(7), target('windows-x64'))).toBe(false)
  })
})

const run = <A>(body: Effect.Effect<A, unknown, FileSystem.FileSystem | Scope.Scope>) =>
  Effect.runPromise(body.pipe(Effect.scoped, Effect.provide(BunFileSystem.layer)))

const place = (path: string, bytes: Uint8Array) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(join(path, '..'), { recursive: true })
    yield* fs.writeFile(path, bytes)
  })

const linuxX64: Facts = { platform: 'linux', arch: 'x64', libc: 'glibc' }

describe('nativeExecutable', () => {
  test('skips a corrupt nested binary and takes the hoisted package', () =>
    run(
      Effect.gen(function* () {
        const base = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped()
        const root = join(base, 'webular')
        const good = join(base, 'webular-linux-x64', 'bin', 'webular')
        yield* place(
          join(root, 'node_modules', 'webular-linux-x64', 'bin', 'webular'),
          new Uint8Array(9),
        )
        yield* place(good, elfX64)
        expect(yield* nativeExecutable(root, linuxX64)).toEqual(Option.some(good))
      }),
    ))
  test('a wrong-CPU binary is never picked', () =>
    run(
      Effect.gen(function* () {
        const root = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped()
        yield* place(join(root, 'dist', 'bin', 'webular-linux-x64'), machOArm64)
        expect(yield* nativeExecutable(root, linuxX64)).toEqual(Option.none())
      }),
    ))
  test('Windows finds the .exe from a local compile:all build', () =>
    run(
      Effect.gen(function* () {
        const root = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped()
        const exe = join(root, 'dist', 'bin', 'webular-windows-arm64.exe')
        yield* place(exe, peArm64)
        const facts = { platform: 'win32', arch: 'arm64' }
        expect(yield* nativeExecutable(root, facts)).toEqual(Option.some(exe))
      }),
    ))
  test('an unsupported machine resolves to nothing (Bun fallback)', () =>
    run(
      Effect.gen(function* () {
        const facts = { platform: 'aix', arch: 'ppc64' }
        expect(yield* nativeExecutable('/', facts)).toEqual(Option.none())
      }),
    ))
})
