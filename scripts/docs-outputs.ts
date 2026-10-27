// bun scripts/docs-outputs.ts (mise run docs:outputs) records the real text and
// --json output of each URL command against the contract fixture site, into
// docs/site/reference/command-output.json. The command pages show it as is,
// except that the fixture's local address reads as https://example.com and the
// temp folder the run writes in is left off file paths.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { CONTRACT_ROUTES, JSON_RUNS } from '../tests/_support/contract-runs.ts'
import { startFixture } from '../tests/_support/fixture.ts'

const ROOT = new URL('..', import.meta.url).pathname
const OUT = `${ROOT}docs/site/reference/command-output.json`
// A fixed date and ranking, so a rerun on the same code gives the same output.
const ENV = { WEBULAR_AS_OF: '2026-01-01', WEBULAR_DETERMINISTIC: '1', WEBULAR_NO_CACHE: '1' }

// Each run gets its own monitor database, so text and --json both show a first visit.
const run = (cwd: string, cmd: string, args: string[]) =>
  Effect.flatMap(ChildProcessSpawner.ChildProcessSpawner, (spawner) =>
    spawner.string(
      ChildProcess.make(process.execPath, [`${ROOT}src/commands/${cmd}.ts`, ...args], {
        cwd,
        env: { ...ENV, WEBULAR_DB: `${cwd}/${args.length}.db` },
        extendEnv: true,
      }),
    ),
  )

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const fx = yield* startFixture(() => CONTRACT_ROUTES)
  const dir = yield* fs.realPath(yield* fs.makeTempDirectoryScoped())
  const shown = (text: string) =>
    text.replaceAll(fx.origin, 'https://example.com').replaceAll(`${dir}/`, '').trim()
  const out: Record<string, { args: string; text: string; json: string }> = {}
  for (const [cmd, argsOf] of Object.entries(JSON_RUNS)) {
    const args = argsOf(fx.origin, '.')
    const text = yield* run(dir, cmd, args)
    const json = yield* run(dir, cmd, [...args, '--json'])
    out[cmd] = { args: shown(args.join(' ')), text: shown(text), json: shown(json) }
  }
  yield* fs.writeFileString(OUT, `${JSON.stringify(out, null, 2)}\n`)
  yield* Effect.log(`docs outputs: ${Object.keys(out).length} commands to ${OUT}`)
})

if (import.meta.main)
  program.pipe(Effect.scoped, Effect.provide(BunServices.layer), BunRuntime.runMain)
