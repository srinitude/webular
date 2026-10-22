// scripts/install.sh against a fake release served by Bun.serve on loopback:
// only the baked checksum decides, an unbaked copy asks the GitHub release for
// its sums, a missing gh is noted, PATH lines are added once, and so on.
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
  WEBULAR_VERIFY_ATTESTATION: '0',
  ZDOTDIR: '',
  SHELL: '/bin/sh',
}
const sh = (argv: string[], env: Record<string, string>, stdin?: string) =>
  runProc(['sh', ...argv], { env, extendEnv: true, timeoutMs: 30_000, ...(stdin ? { stdin } : {}) })

const script = `${ROOT}scripts/install.sh`
const pathLine = (home: string) => `export PATH="${home}/.webular/bin:$PATH" # webular\n`

// install.sh baked as release.yml bakes it, with `sum` as the asset's only line.
// The mirror's own SHA256SUMS always matches, so only the baked line decides.
const bake = (text: string, sum: string) =>
  text.replaceAll('__WEBULAR_VERSION__', '1.0.0').replace('__WEBULAR_SUMS__', `${sum}  ${ASSET}`)

const setup = (sum: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const home = yield* tmpDir('install-sh-')
    const fx = yield* startFixture(() => ({
      [`/release/${ASSET}`]: () => new Response(BINARY),
      '/release/SHA256SUMS': () => new Response(`${sha256(BINARY)}  ${ASSET}\n`),
    }))
    const env = { ...CLEAN, HOME: home, WEBULAR_BASE_URL: `${fx.origin}/release` }
    const baked = `${home}/install.sh`
    yield* fs.writeFileString(baked, bake(yield* fs.readFileString(script), sum))
    const read = (path: string) =>
      Effect.flatMap(fs.exists(path), (ok) =>
        ok ? fs.readFileString(path) : Effect.succeed(undefined),
      )
    return { fs, home, env, read, baked, origin: fx.origin, exe: `${home}/.webular/bin/webular` }
  })

// install.sh is the macOS and Linux path; Windows has install.ps1.
const posixOnly = test.skipIf(process.platform === 'win32')

posixOnly(
  'installs the asset and adds one PATH line, even when run twice',
  eff(
    Effect.gen(function* () {
      const s = yield* setup(sha256(BINARY))
      expect((yield* sh([s.baked], s.env)).code).toBe(0)
      expect(yield* s.read(s.exe)).toBe(BINARY)
      expect((yield* sh([s.baked], s.env)).code).toBe(0)
      expect(yield* s.read(`${s.home}/.profile`)).toBe(pathLine(s.home))
    }),
  ),
)

posixOnly(
  'refuses a download that misses the baked checksum, whatever the mirror sums say',
  eff(
    Effect.gen(function* () {
      const s = yield* setup('0'.repeat(64))
      const out = yield* sh([s.baked], s.env)
      expect(out.code).not.toBe(0)
      expect(out.stderr).toContain('webular install: checksum mismatch')
      expect(yield* s.read(s.exe)).toBeUndefined()
    }),
  ),
)

posixOnly(
  'an unbaked copy asks the GitHub release for SHA256SUMS, never the mirror',
  eff(
    Effect.gen(function* () {
      const s = yield* setup(sha256(BINARY))
      const off = 'http://127.0.0.1:9'
      const env = { ...s.env, HTTPS_PROXY: off, https_proxy: off, NO_PROXY: '', no_proxy: '' }
      const out = yield* sh([script], env)
      expect(out.stderr).toContain(
        'download failed: https://github.com/srinitude/webular/releases/latest/download/SHA256SUMS',
      )
      expect(yield* s.read(s.exe)).toBeUndefined()
    }),
  ),
)

const TOOLS = 'sh curl awk grep mktemp rm cp chmod mv mkdir id dirname basename sha256sum shasum'

posixOnly(
  'with no gh on PATH it notes the skipped attestation; WEBULAR_VERIFY_ATTESTATION=1 stops',
  eff(
    Effect.gen(function* () {
      const s = yield* setup(sha256(BINARY))
      const bin = `${s.home}/tools`
      yield* s.fs.makeDirectory(bin)
      const found = TOOLS.split(' ').flatMap((tool) => {
        const at = Bun.which(tool)
        return at ? [[at, `${bin}/${tool}`] as const] : []
      })
      yield* Effect.forEach(found, ([at, to]) => s.fs.symlink(at, to), { discard: true })
      const env = { ...s.env, PATH: bin, WEBULAR_VERIFY_ATTESTATION: '' }
      const required = yield* sh([s.baked], { ...env, WEBULAR_VERIFY_ATTESTATION: '1' })
      expect(required.stderr).toContain('WEBULAR_VERIFY_ATTESTATION=1 needs gh')
      expect(yield* s.read(s.exe)).toBeUndefined()
      const out = yield* sh([s.baked], env)
      expect(out.code).toBe(0)
      expect(out.stderr).toContain('gh is not on PATH, so the build attestation was not checked')
      expect(yield* s.read(s.exe)).toBe(BINARY)
    }),
  ),
)

posixOnly(
  'names a release that does not exist, and refuses a bad version and a plain-http mirror',
  eff(
    Effect.gen(function* () {
      const s = yield* setup(sha256(BINARY))
      const env = { ...s.env, WEBULAR_BASE_URL: `${s.origin}/missing` }
      const out = yield* sh([s.baked, '--version', 'v9.9.9'], env)
      expect(out.stderr).toContain('Release v9.9.9 not found')
      const bad = yield* sh([s.baked, '--version', '1.2'], s.env)
      expect(bad.stderr).toContain('version must look like 1.2.3')
      const http = yield* sh([s.baked], { ...s.env, WEBULAR_BASE_URL: 'http://example.com/r' })
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
      expect((yield* sh([s.baked, '--no-modify-path'], s.env)).code).toBe(0)
      expect(yield* s.read(s.exe)).toBe(BINARY)
      expect(yield* s.read(`${s.home}/.profile`)).toBeUndefined()
      expect((yield* sh([s.baked], s.env)).code).toBe(0)
      expect((yield* sh([s.baked, '--uninstall'], s.env)).code).toBe(0)
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
      const text = yield* s.fs.readFileString(s.baked)
      yield* sh([], s.env, text.slice(0, Math.floor(text.length / 2)))
      yield* sh([], s.env, text.slice(0, text.lastIndexOf('main "$@"')))
      expect(yield* s.read(s.exe)).toBeUndefined()
    }),
  ),
)

test(
  'the installer downloads with the README TLS flags and runs gh attestation by default',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(script)
      expect(text).toContain(`*) proto='=https' ;;`)
      expect(text).toContain('curl --proto "$proto" --tlsv1.2 --retry 3 -fsSL')
      expect(text).toContain('--signer-workflow "$repo/.github/workflows/release.yml"')
      expect(text).not.toMatch(/scoop|homebrew|winget/i)
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
