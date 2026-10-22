// Bucket A contract: WEBULAR_SANDBOX=1 confines output paths (opt-in). Real
// command runs against the local fixture; default behavior is covered elsewhere.
import { afterAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem } from 'effect'
import { runCli, runInProcess } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff, tmpDir } from '../_support/run.ts'

const OUT = '.tmp-sandbox-out.md'

const fx = useFixture(defaultRoutes)
afterAll(
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      yield* fs.remove(`${ROOT}${OUT}`, { force: true })
      yield* fs.remove(`${ROOT}webular-monitor.db`, { force: true })
    }),
  ),
)

// Cases run in this process; the absolute -o case is the one real-process smoke run.
const scrape = (args: string[], run: typeof runCli = runInProcess) =>
  run('src/commands/scrape.ts', ['--url', `${fx.origin}/`, ...args], {
    env: { ...process.env, WEBULAR_SANDBOX: '1' },
  })

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
        const { code } = yield* scrape(['-o', OUT])
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
        const { code, err } = yield* runInProcess(
          'src/commands/scrape.ts',
          ['--url', `${fx.origin}/`, '-o', 'link/evil.md'],
          { env: { ...process.env, WEBULAR_SANDBOX: '1', WEBULAR_OUTPUT_DIR: base } },
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
        const { code, out } = yield* runInProcess(
          'src/commands/monitor.ts',
          ['--url', `${fx.origin}/c`, '--json'],
          { env: { ...process.env, WEBULAR_SANDBOX: '1' } },
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
        const base = yield* tmpDir('webular-sb-inv-')
        const { code } = yield* runInProcess(
          'src/commands/scrape.ts',
          ['--url', `${fx.origin}/`, '-o', 'inv-out.md'],
          { env: { ...process.env, WEBULAR_SANDBOX: '1', WEBULAR_INVOKE_DIR: base } },
        )
        const fs = yield* FileSystem.FileSystem
        const written = yield* fs.exists(join(base, 'inv-out.md'))
        yield* fs.remove(`${ROOT}inv-out.md`, { force: true })
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
        const { code, out } = yield* runInProcess(
          'src/commands/parse.ts',
          ['--file', file, '--json'],
          {
            env: { ...process.env, WEBULAR_SANDBOX: '1' },
          },
        )
        expect(code).toBe(0)
        expect(out).toContain('readable sandbox input')
      }),
    ),
    15_000,
  )
})
