// Shell completions: each generated script parses in its own shell, names
// every command, and the bash function really completes `webular sc` to
// scrape. Output goes to a git-ignored folder under dist/ inside the repo.
import { beforeAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem } from 'effect'
import { COMMAND_NAMES } from '../../src/cli/commands.ts'
import { runProc } from '../../src/core/proc.ts'
import { writeCompletions } from '../../src/release/completions.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const DIR = join(ROOT, 'dist', 'completions-test')
const PWSH = '/opt/homebrew/bin/pwsh'
const file = (name: string) => join(DIR, name)

const run = (argv: [string, ...string[]]) => runProc(argv, { timeoutMs: 30_000 })

beforeAll(eff(writeCompletions(DIR)), 30_000)

test(
  'every script names every command',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      for (const name of ['webular.bash', '_webular', 'webular.fish', 'webular.ps1']) {
        const text = yield* fs.readFileString(file(name))
        for (const cmd of COMMAND_NAMES) expect(text).toContain(cmd)
      }
    }),
  ),
)

test(
  'bash, zsh, and fish parse the scripts with no errors',
  eff(
    Effect.gen(function* () {
      const checks = [
        ['bash', '-n', file('webular.bash')],
        ['zsh', '-n', file('_webular')],
        ['fish', '--no-execute', file('webular.fish')],
      ] as const
      for (const argv of checks) {
        const out = yield* run([...argv])
        expect([argv[0], out.code, out.stderr]).toEqual([argv[0], 0, ''])
      }
    }),
  ),
  30_000,
)

test(
  'PowerShell parses the script with zero errors',
  eff(
    Effect.gen(function* () {
      if (!(yield* (yield* FileSystem.FileSystem).exists(PWSH))) return
      const script = `$e = $null; $t = $null; [System.Management.Automation.Language.Parser]::ParseFile('${file('webular.ps1')}', [ref]$t, [ref]$e) | Out-Null; $e.Count`
      const out = yield* run([PWSH, '-NoProfile', '-Command', script])
      expect(out.stdout.trim()).toBe('0')
    }),
  ),
  30_000,
)

test(
  'bash completes `webular sc` to scrape',
  eff(
    Effect.gen(function* () {
      const script = `source '${file('webular.bash')}'; COMP_WORDS=(webular sc); COMP_CWORD=1; _webular; echo "\${COMPREPLY[@]}"`
      const out = yield* run(['bash', '-c', script])
      expect(out.stdout.trim().split(' ')).toContain('scrape')
    }),
  ),
  30_000,
)
