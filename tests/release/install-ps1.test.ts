// scripts/install.ps1 under pwsh against a release folder in out/ (gitignored);
// WEBULAR_OS and WEBULAR_ARCH force the windows-x64 asset on any OS with pwsh.
import { afterAll, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, ManagedRuntime } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { assetName, TARGETS } from '../../src/core/platform.ts'
import { ROOT } from '../_support/root.ts'

const runtime = ManagedRuntime.make(BunServices.layer)
afterAll(() => runtime.dispose())

const BINARY = 'MZ fixture-ok\n'
const sha256 = (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('hex')
const windowsX64 = TARGETS.find((target) => target.os === 'win32' && target.cpu === 'x64')
const SCRIPT = `${ROOT}scripts/install.ps1`
const PWSH = Bun.which('pwsh') ?? 'pwsh'

// Runs an installer script with env and returns its exit code and combined output.
const run = (env: Record<string, string>, script = SCRIPT) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const command = ChildProcess.make(PWSH, ['-NoProfile', '-File', script], {
      env: { WEBULAR_OS: 'windows', ...env },
      extendEnv: true,
    })
    const output = yield* spawner.string(command, { includeStderr: true })
    const code = yield* spawner.exitCode(command)
    return { code: Number(code), output: output.trim() }
  }).pipe(Effect.scoped)

const QUIET = { WEBULAR_ARCH: 'x64', WEBULAR_NO_MODIFY_PATH: '1', WEBULAR_VERIFY_ATTESTATION: '0' }

// A release folder whose SHA256SUMS always matches, and a copy of install.ps1
// baked as release.yml bakes it, with `sum` as the asset's only line (or the
// unbaked script when `sum` is undefined). Runs it into <dir>/home.
const install = (sum: string | undefined, baseFor: (dir: string) => string, env = {}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    if (!windowsX64) return yield* Effect.die('no windows-x64 target')
    yield* fs.makeDirectory(`${ROOT}out`, { recursive: true })
    const dir = yield* fs.makeTempDirectoryScoped({
      directory: `${ROOT}out`,
      prefix: 'install-ps1-',
    })
    const asset = assetName(windowsX64)
    yield* fs.writeFileString(`${dir}/${asset}`, BINARY)
    yield* fs.writeFileString(`${dir}/SHA256SUMS`, `${sha256(BINARY)}  ${asset}\n`)
    const text = yield* fs.readFileString(SCRIPT)
    const baked = sum === undefined ? text : text.replaceAll('__WEBULAR_VERSION__', '1.0.0')
    const script = `${dir}/install.ps1`
    yield* fs.writeFileString(script, baked.replace('__WEBULAR_SUMS__', `${sum}  ${asset}`))
    const where = { WEBULAR_BASE_URL: baseFor(dir), WEBULAR_INSTALL: `${dir}/home` }
    const out = yield* run({ ...QUIET, ...where, ...env }, script)
    const exe = `${dir}/home/bin/webular.exe`
    const installed = (yield* fs.exists(exe)) ? yield* fs.readFileString(exe) : undefined
    return { ...out, installed }
  }).pipe(Effect.scoped)

// A cold pwsh start takes seconds, and `run` spawns it twice; 60 s holds under a busy suite.
const PWSH_TIMEOUT = 60_000
const withPwsh = test.skipIf(!Bun.which('pwsh'))
// A file:// URL built from a drive-letter path is not portable, so the
// file:// case runs off Windows; the plain-folder case runs everywhere.
const withPwshOffWindows = test.skipIf(!Bun.which('pwsh') || process.platform === 'win32')

type Services = ManagedRuntime.ManagedRuntime.Services<typeof runtime>
// A test body: runs the effect on the runtime, then asserts on its result.
const outcome =
  <A, E>(effect: Effect.Effect<A, E, Services>, assert: (result: A) => void) =>
  () =>
    runtime.runPromise(Effect.map(effect, assert))

const expectInstalled = (base: (dir: string) => string) =>
  outcome(install(sha256(BINARY), base), ({ code, installed }) => {
    expect(code).toBe(0)
    expect(installed).toBe(BINARY)
  })

withPwsh(
  'installs the windows asset from a local folder when its checksum matches',
  expectInstalled((dir) => dir),
  PWSH_TIMEOUT,
)

withPwshOffWindows(
  'installs the windows asset from a file:// URL when its checksum matches',
  expectInstalled((dir) => `file://${dir}`),
  PWSH_TIMEOUT,
)

withPwsh(
  'refuses a download that misses the baked checksum, whatever the folder sums say',
  outcome(
    install('0'.repeat(64), (dir) => dir),
    ({ code, installed }) => {
      expect(code).not.toBe(0)
      expect(installed).toBeUndefined()
    },
  ),
  PWSH_TIMEOUT,
)

withPwsh(
  'an unbaked copy asks the GitHub release for SHA256SUMS, never the mirror',
  outcome(
    install(undefined, (dir) => dir, { HTTPS_PROXY: 'http://127.0.0.1:9' }),
    ({ code, output, installed }) => {
      expect(code).not.toBe(0)
      expect(output).toContain(
        'download failed: https://github.com/srinitude/webular/releases/latest/download/SHA256SUMS',
      )
      expect(installed).toBeUndefined()
    },
  ),
  PWSH_TIMEOUT,
)

// No gh on PATH: out/ holds no gh, so the attestation step cannot run.
const NO_GH = { PATH: `${ROOT}out`, WEBULAR_VERIFY_ATTESTATION: '' }
const noGh = (env = {}) => install(sha256(BINARY), (dir) => dir, { ...NO_GH, ...env })

withPwsh(
  'with no gh on PATH it notes the skipped attestation',
  outcome(noGh(), ({ code, output }) => {
    expect(code).toBe(0)
    expect(output).toContain('gh is not on PATH, so the build attestation was not checked')
  }),
  PWSH_TIMEOUT,
)

withPwsh(
  'with no gh on PATH, WEBULAR_VERIFY_ATTESTATION=1 stops',
  outcome(noGh({ WEBULAR_VERIFY_ATTESTATION: '1' }), ({ output, installed }) => {
    expect(output).toContain('WEBULAR_VERIFY_ATTESTATION=1 needs gh')
    expect(installed).toBeUndefined()
  }),
  PWSH_TIMEOUT,
)

withPwsh(
  'parses with no syntax errors',
  () =>
    runtime.runPromise(
      Effect.gen(function* () {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
        const probe = `$e = $null; [System.Management.Automation.Language.Parser]::ParseFile($env:INSTALL_PS1, [ref]$null, [ref]$e) | Out-Null; $e | ForEach-Object { $_.Message }; exit $e.Count`
        const command = ChildProcess.make(PWSH, ['-NoProfile', '-Command', probe], {
          env: { INSTALL_PS1: SCRIPT },
          extendEnv: true,
        })
        const output = yield* spawner.string(command, { includeStderr: true })
        const code = yield* spawner.exitCode(command)
        expect({ code: Number(code), output }).toEqual({ code: 0, output: '' })
      }).pipe(Effect.scoped),
    ),
  PWSH_TIMEOUT,
)

// Each row: the env, then a line the installer must print as it refuses.
const REFUSALS: readonly (readonly [Record<string, string>, string])[] = [
  [{ WEBULAR_BASE_URL: 'http://127.0.0.1:9' }, 'refusing http://'],
  [{ WEBULAR_VERSION: '1.2', WEBULAR_BASE_URL: 'https://127.0.0.1:9' }, "bad version '1.2'"],
]

for (const [env, refusal] of REFUSALS) {
  withPwsh(
    `refuses before any download: ${refusal}`,
    outcome(run({ WEBULAR_ARCH: 'x64', ...env }), ({ code, output }) => {
      expect(code).not.toBe(0)
      expect(output).toContain(refusal)
    }),
    PWSH_TIMEOUT,
  )
}

// Each row: WEBULAR_ARCH, then the asset a dry run prints.
const ASSET_CHOICES: readonly (readonly [string, string])[] = [
  ['x64', 'webular-windows-x64.exe'],
  ['AMD64', 'webular-windows-x64.exe'],
  ['arm64', 'webular-windows-arm64.exe'],
  ['ARM64', 'webular-windows-arm64.exe'],
]

for (const [arch, expected] of ASSET_CHOICES) {
  withPwsh(
    `picks ${expected} for arch ${arch}`,
    outcome(run({ WEBULAR_ARCH: arch, WEBULAR_PRINT_ASSET: '1' }), (result) => {
      expect(result).toEqual({ code: 0, output: expected })
    }),
    PWSH_TIMEOUT,
  )
}
