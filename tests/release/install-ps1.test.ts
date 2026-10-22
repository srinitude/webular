// scripts/install.ps1 under pwsh against a local release folder inside the repo
// (out/, gitignored). WEBULAR_OS and WEBULAR_ARCH force the windows-x64 asset,
// so this runs on any OS with pwsh: a matching checksum installs webular.exe,
// and a SHA256SUMS that disagrees with the download installs nothing. The script
// also parses cleanly and refuses a plain http:// base URL.
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

const install = (sum: string, baseFor: (dir: string) => string) =>
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
    yield* fs.writeFileString(`${dir}/SHA256SUMS`, `${sum}  ${asset}\n`)
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const code = yield* spawner.exitCode(
      ChildProcess.make('pwsh', ['-NoProfile', '-File', `${ROOT}scripts/install.ps1`], {
        env: {
          WEBULAR_BASE_URL: baseFor(dir),
          WEBULAR_INSTALL: `${dir}/home`,
          WEBULAR_OS: 'windows',
          WEBULAR_ARCH: 'x64',
          WEBULAR_NO_MODIFY_PATH: '1',
        },
        extendEnv: true,
        stdout: 'ignore',
        stderr: 'ignore',
      }),
    )
    const exe = `${dir}/home/bin/webular.exe`
    const installed = (yield* fs.exists(exe)) ? yield* fs.readFileString(exe) : undefined
    return { code: Number(code), installed }
  }).pipe(Effect.scoped)

// pwsh takes seconds to start cold, past the 5 s default under a busy suite.
const PWSH_TIMEOUT = 30_000
const withPwsh = test.skipIf(!Bun.which('pwsh'))
// A file:// URL built from a drive-letter path is not portable, so the
// file:// case runs off Windows; the plain-folder case runs everywhere.
const withPwshOffWindows = test.skipIf(!Bun.which('pwsh') || process.platform === 'win32')

const expectInstalled = (base: (dir: string) => string) => () =>
  runtime.runPromise(
    Effect.map(install(sha256(BINARY), base), ({ code, installed }) => {
      expect(code).toBe(0)
      expect(installed).toBe(BINARY)
    }),
  )

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
  'refuses a download whose checksum does not match',
  () =>
    runtime.runPromise(
      Effect.map(
        install('0'.repeat(64), (dir) => dir),
        ({ code, installed }) => {
          expect(code).not.toBe(0)
          expect(installed).toBeUndefined()
        },
      ),
    ),
  PWSH_TIMEOUT,
)

const SCRIPT = `${ROOT}scripts/install.ps1`

withPwsh(
  'parses with no syntax errors',
  () =>
    runtime.runPromise(
      Effect.gen(function* () {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
        const probe = `$e = $null; [System.Management.Automation.Language.Parser]::ParseFile($env:INSTALL_PS1, [ref]$null, [ref]$e) | Out-Null; $e | ForEach-Object { $_.Message }; exit $e.Count`
        const command = ChildProcess.make('pwsh', ['-NoProfile', '-Command', probe], {
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

withPwsh(
  'refuses a plain http:// base URL before any download',
  () =>
    runtime.runPromise(
      Effect.gen(function* () {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
        const command = ChildProcess.make('pwsh', ['-NoProfile', '-File', SCRIPT], {
          env: {
            WEBULAR_BASE_URL: 'http://127.0.0.1:9',
            WEBULAR_OS: 'windows',
            WEBULAR_ARCH: 'x64',
          },
          extendEnv: true,
        })
        const output = yield* spawner.string(command, { includeStderr: true })
        const code = yield* spawner.exitCode(command)
        expect(Number(code)).not.toBe(0)
        expect(output).toContain('refusing http://')
      }).pipe(Effect.scoped),
    ),
  PWSH_TIMEOUT,
)
