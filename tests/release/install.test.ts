// scripts/install.sh against a fake release served by Bun.serve on loopback:
// a matching checksum installs, a bad one installs nothing, a missing release
// is named, PATH lines are added once, and a cut-off script does nothing.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { startFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { eff, tmpDir } from '../_support/run.ts'

const BINARY = '#!/bin/sh\necho fixture-ok\n'
const ASSET = 'webular-linux-x64'
const sha256 = (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('hex')

// Inherits PATH; pins the asset and blanks every variable that steers the installer.
const CLEAN = {
  CI: '',
  GITHUB_PATH: '',
  WEBULAR_INSTALL: '',
  WEBULAR_VERSION: '',
  WEBULAR_OS: 'linux',
  WEBULAR_ARCH: 'x64',
  WEBULAR_LIBC: 'glibc',
  WEBULAR_BASELINE: '0',
  ZDOTDIR: '',
  SHELL: '/bin/sh',
}
const sh = (argv: string[], env: Record<string, string>, stdin?: string) =>
  runProc(['sh', ...argv], { env, extendEnv: true, timeoutMs: 30_000, ...(stdin ? { stdin } : {}) })

const setup = (sum: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const home = yield* tmpDir('install-sh-')
    const fx = yield* startFixture(() => ({
      [`/release/${ASSET}`]: () => new Response(BINARY),
      '/release/SHA256SUMS': () => new Response(`${sum}  ${ASSET}\n`),
    }))
    const env = { ...CLEAN, HOME: home, WEBULAR_BASE_URL: `${fx.origin}/release` }
    const read = (path: string) =>
      Effect.flatMap(fs.exists(path), (ok) =>
        ok ? fs.readFileString(path) : Effect.succeed(undefined),
      )
    return { fs, home, env, read, origin: fx.origin, exe: `${home}/.webular/bin/webular` }
  })

const script = `${ROOT}scripts/install.sh`
const pathLine = (home: string) => `export PATH="${home}/.webular/bin:$PATH" # webular\n`

// install.sh is the macOS and Linux path; Windows has install.ps1.
const posixOnly = test.skipIf(process.platform === 'win32')

posixOnly(
  'installs the asset and adds one PATH line, even when run twice',
  eff(
    Effect.gen(function* () {
      const s = yield* setup(sha256(BINARY))
      expect((yield* sh([script], s.env)).code).toBe(0)
      expect(yield* s.read(s.exe)).toBe(BINARY)
      expect((yield* sh([script], s.env)).code).toBe(0)
      expect(yield* s.read(`${s.home}/.profile`)).toBe(pathLine(s.home))
    }),
  ),
)

posixOnly(
  'refuses a download whose checksum does not match and installs nothing',
  eff(
    Effect.gen(function* () {
      const s = yield* setup('0'.repeat(64))
      const out = yield* sh([script], s.env)
      expect(out.code).not.toBe(0)
      expect(out.stderr).toContain('webular install: checksum mismatch')
      expect(yield* s.read(s.exe)).toBeUndefined()
    }),
  ),
)

posixOnly(
  'names a release that does not exist',
  eff(
    Effect.gen(function* () {
      const s = yield* setup(sha256(BINARY))
      const env = { ...s.env, WEBULAR_BASE_URL: `${s.origin}/missing` }
      const out = yield* sh([script, '--version', 'v9.9.9'], env)
      expect(out.code).not.toBe(0)
      expect(out.stderr).toContain('Release v9.9.9 not found')
      expect(yield* s.read(s.exe)).toBeUndefined()
    }),
  ),
)

posixOnly(
  'refuses a bad version and a plain-http mirror',
  eff(
    Effect.gen(function* () {
      const s = yield* setup(sha256(BINARY))
      const bad = yield* sh([script, '--version', '1.2'], s.env)
      expect(bad.stderr).toContain('version must look like 1.2.3')
      const http = yield* sh([script], { ...s.env, WEBULAR_BASE_URL: 'http://example.com/r' })
      expect(http.stderr).toContain('must start with https://')
      expect(yield* s.read(s.exe)).toBeUndefined()
    }),
  ),
)

posixOnly(
  '--no-modify-path installs but leaves shell files alone; --uninstall removes both',
  eff(
    Effect.gen(function* () {
      const s = yield* setup(sha256(BINARY))
      expect((yield* sh([script, '--no-modify-path'], s.env)).code).toBe(0)
      expect(yield* s.read(s.exe)).toBe(BINARY)
      expect(yield* s.read(`${s.home}/.profile`)).toBeUndefined()
      expect((yield* sh([script], s.env)).code).toBe(0)
      expect((yield* sh([script, '--uninstall'], s.env)).code).toBe(0)
      expect(yield* s.read(s.exe)).toBeUndefined()
      expect(yield* s.read(`${s.home}/.profile`)).toBe('')
    }),
  ),
)

posixOnly(
  'a script cut off mid-download installs nothing',
  eff(
    Effect.gen(function* () {
      const s = yield* setup(sha256(BINARY))
      const text = yield* s.fs.readFileString(script)
      yield* sh([], s.env, text.slice(0, Math.floor(text.length / 2)))
      yield* sh([], s.env, text.slice(0, text.lastIndexOf('main "$@"')))
      expect(yield* s.read(s.exe)).toBeUndefined()
    }),
  ),
)

posixOnly(
  'the installer parses as POSIX sh and passes shellcheck when present',
  eff(
    Effect.gen(function* () {
      expect((yield* sh(['-n', script], CLEAN)).code).toBe(0)
      if (!Bun.which('shellcheck')) return
      const out = yield* runProc(['shellcheck', '-s', 'sh', script], { timeoutMs: 30_000 })
      expect([out.code, out.stdout]).toEqual([0, ''])
    }),
  ),
)
