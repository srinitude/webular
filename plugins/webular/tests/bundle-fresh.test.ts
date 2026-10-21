// Outcome eval: the committed bundle dist/server.js is what a fresh build of
// the plugin source produces, so a source change that skipped
// `mise run plugin:bundle` cannot ship a stale server to an agent host.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { Effect, FileSystem, Path, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { eff, tmpDir } from '../../../tests/_support/run.ts'

const PLUGIN = fileURLToPath(new URL('..', import.meta.url))
const COMMITTED = `${PLUGIN}dist/server.js`

// The same flags as the plugin:bundle task in mise.toml; keep the two in step.
// mise exec pins the bun version mise.toml names: other bun versions minify to
// different bytes, so a bare `bun test` on another bun still compares fairly.
const build = (entry: string, outfile: string) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const args = ['exec', '--', 'bun', 'build', '--target=bun', '--minify', entry]
    const cmd = ChildProcess.make('mise', [...args, `--outfile=${outfile}`], { cwd: PLUGIN })
    const h = yield* spawner.spawn(cmd)
    const [err, code] = yield* Effect.all(
      [Stream.mkString(Stream.decodeText(h.stderr)), h.exitCode],
      { concurrency: 2 },
    )
    expect({ code: Number(code), err }).toEqual({ code: 0, err: '' })
  }).pipe(Effect.scoped)

test(
  'the committed plugin bundle equals a fresh build of the plugin source',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const fresh = path.join(yield* tmpDir('bundle-fresh-'), 'server.js')
      yield* build(`${PLUGIN}src/server.ts`, fresh)
      const [built, committed] = yield* Effect.all([fs.readFile(fresh), fs.readFile(COMMITTED)], {
        concurrency: 2,
      })
      // A boolean keeps a 2 MB mismatch out of the failure message.
      expect(Buffer.from(built).equals(committed)).toBe(true)
    }),
  ),
  120_000,
)
