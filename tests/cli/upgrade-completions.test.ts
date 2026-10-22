// `webular upgrade` and `webular completions`: upgrade reads `/latest` from a
// local server, names the installer receipt's command, and runs nothing
// without --yes; completions prints a script its shell can parse.
import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { Config, Effect, FileSystem } from 'effect'
import pkg from '../../package.json' with { type: 'json' }
import { runProc } from '../../src/core/proc.ts'
import { runCli } from '../_support/cli.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff, tmpDir } from '../_support/run.ts'

const INSTALL_SH = "curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/install.sh | sh"

const cli = (cmd: string, args: string[], extra: Record<string, string> = {}) =>
  Effect.flatMap(Config.String('PATH'), (PATH) =>
    runCli(`src/commands/${cmd}.ts`, args, { env: { PATH, WEBULAR_JEV: 'off', ...extra } }),
  )

// A config home holding a real installer receipt, and a server whose /latest says `body`.
const setup = (body: string, source = 'install.sh') =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const home = yield* tmpDir('webular-upgrade-')
    yield* fs.makeDirectory(join(home, 'webular'), { recursive: true })
    const receipt = {
      version: '0.0.1',
      source,
      install_prefix: join(home, 'bin'),
      modify_path: false,
      rc_files: [],
      env_file: null,
    }
    yield* fs.writeFileString(join(home, 'webular', 'receipt.json'), JSON.stringify(receipt))
    const fx = yield* startFixture(() => ({ '/latest': () => new Response(body) }))
    return { HOME: home, XDG_CONFIG_HOME: home, WEBULAR_LATEST_URL: `${fx.origin}/latest` }
  })

test(
  'upgrade prints the install.sh command from the receipt and runs nothing without --yes',
  eff(
    Effect.gen(function* () {
      const r = yield* cli('upgrade', [], yield* setup('v99.0.0\n'))
      expect(r.code).toBe(0)
      expect(r.out).toContain(`${pkg.version} -> 99.0.0`)
      expect(r.out).toContain(INSTALL_SH)
      expect(r.err).toContain('--yes')
    }),
  ),
  30_000,
)

test(
  'upgrade names the PowerShell installer for an install.ps1 receipt',
  eff(
    Effect.gen(function* () {
      const r = yield* cli('upgrade', [], yield* setup('99.0.0', 'install.ps1'))
      expect(r.out).toContain('irm https://webular.dev/install.ps1 | iex')
    }),
  ),
  30_000,
)

test(
  'upgrade says already on latest when the versions match',
  eff(
    Effect.gen(function* () {
      const r = yield* cli('upgrade', [], yield* setup(`v${pkg.version}`))
      expect(r.code).toBe(0)
      expect(r.out).toContain('already on latest')
    }),
  ),
  30_000,
)

test(
  'upgrade fails, running nothing, when /latest is not a version',
  eff(
    Effect.gen(function* () {
      const r = yield* cli('upgrade', ['--yes'], yield* setup('<html>oops</html>'))
      expect(r.code).toBe(1)
      expect(r.err).toContain('did not return a version')
    }),
  ),
  30_000,
)

test(
  'upgrade without a receipt or a known install path says it could not tell',
  eff(
    Effect.gen(function* () {
      const env = yield* setup('99.0.0')
      const r = yield* cli('upgrade', [], { ...env, XDG_CONFIG_HOME: join(env.HOME, 'empty') })
      expect(r.code).toBe(1)
      expect(r.err).toContain('could not tell how webular was installed')
    }),
  ),
  30_000,
)

test(
  'completions prints a bash script that bash parses and that names every command',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const r = yield* cli('completions', ['bash'])
      expect(r.code).toBe(0)
      expect(r.out).toContain('complete -F _webular webular')
      expect(r.out).toContain('upgrade')
      const file = join(yield* tmpDir('webular-comp-'), 'webular.bash')
      yield* fs.writeFileString(file, r.out)
      expect((yield* runProc(['bash', '-n', file], { timeoutMs: 10_000 })).code).toBe(0)
    }),
  ),
  30_000,
)

test(
  'completions rejects an unknown shell with a usage error',
  eff(
    Effect.gen(function* () {
      const r = yield* cli('completions', ['tcsh'])
      expect(r.code).toBe(2)
      expect(r.err).toContain('bash, zsh, fish, powershell')
    }),
  ),
  30_000,
)
