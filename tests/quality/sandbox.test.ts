// Bucket A contract: WEBULAR_SANDBOX=1 confines output paths (opt-in). Real
// command runs against the local fixture; default behavior is covered elsewhere.
// Every run gets its own temp invoke dir, so no output lands in the repo root
// while other suites (the Markdown link check) read it.
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem } from 'effect'
import { runCli, runInProcess } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff, tmpDir } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

// A sandboxed env anchored to a fresh temp dir; runCli adds the parent's PATH.
const sandboxEnv = (extra: Record<string, string> = {}) =>
  Effect.map(tmpDir('webular-sb-'), (dir) => ({
    dir,
    env: { WEBULAR_SANDBOX: '1', WEBULAR_INVOKE_DIR: dir, ...extra },
  }))

// Cases run in this process; the absolute -o case is the one real-process smoke run.
const scrape = (args: string[], run: typeof runCli = runInProcess) =>
  Effect.flatMap(sandboxEnv(), ({ env }) =>
    run('src/commands/scrape.ts', ['--url', `${fx.origin}/`, ...args], { env }),
  )

describe('WEBULAR_SANDBOX confines output paths (opt-in hardening)', () => {
  test(
    'rejects an absolute -o path',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* scrape(['-o', '/tmp/webular-evil.md'], runCli)
        expect(code).not.toBe(0)
        expect(err.toLowerCase()).toContain('sandbox')
      }),
    ),
    15_000,
  )

  test(
    'rejects a parent-directory -o path',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* scrape(['-o', '../escape.md'])
        expect(code).not.toBe(0)
        expect(err.toLowerCase()).toContain('sandbox')
      }),
    ),
    15_000,
  )

  test(
    'allows a contained relative -o path',
    eff(
      Effect.gen(function* () {
        const { code } = yield* scrape(['-o', '.tmp-sandbox-out.md'])
        expect(code).toBe(0)
      }),
    ),
    15_000,
  )

  test(
    'rejects a path through a symlinked parent directory',
    eff(
      Effect.gen(function* () {
        const base = yield* tmpDir('webular-sb-')
        const target = yield* tmpDir('webular-tgt-')
        yield* (yield* FileSystem.FileSystem).symlink(target, join(base, 'link'))
        const { env } = yield* sandboxEnv({ WEBULAR_OUTPUT_DIR: base })
        const { code, err } = yield* runInProcess(
          'src/commands/scrape.ts',
          ['--url', `${fx.origin}/`, '-o', 'link/evil.md'],
          { env },
        )
        expect(code).not.toBe(0)
        expect(err.toLowerCase()).toContain('sandbox')
      }),
    ),
    15_000,
  )

  test(
    'sandboxed monitor accepts its default database path',
    eff(
      Effect.gen(function* () {
        const { env } = yield* sandboxEnv()
        const { code, out } = yield* runInProcess(
          'src/commands/monitor.ts',
          ['--url', `${fx.origin}/c`, '--json'],
          { env },
        )
        expect(code).toBe(0)
        expect(out).toContain('changeStatus')
      }),
    ),
    15_000,
  )

  test(
    'sandbox anchors to the INVOKING directory when routed (gateway cwd is the package root)',
    eff(
      Effect.gen(function* () {
        const { dir, env } = yield* sandboxEnv()
        const { code } = yield* runInProcess(
          'src/commands/scrape.ts',
          ['--url', `${fx.origin}/`, '-o', 'inv-out.md'],
          { env },
        )
        const written = yield* (yield* FileSystem.FileSystem).exists(join(dir, 'inv-out.md'))
        expect(code).toBe(0)
        expect(written).toBe(true)
      }),
    ),
    15_000,
  )

  test(
    'sandbox confines WRITES but does not reject absolute READ inputs',
    eff(
      Effect.gen(function* () {
        const dir = yield* tmpDir('webular-sb-read-')
        const file = join(dir, 'note.txt')
        yield* (yield* FileSystem.FileSystem).writeFileString(file, 'readable sandbox input')
        const { env } = yield* sandboxEnv()
        const { code, out } = yield* runInProcess(
          'src/commands/parse.ts',
          ['--file', file, '--json'],
          { env },
        )
        expect(code).toBe(0)
        expect(out).toContain('readable sandbox input')
      }),
    ),
    15_000,
  )
})
