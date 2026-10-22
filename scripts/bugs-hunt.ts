// Runs the tests that guard one bug class from docs/bug-classes.md (classes in
// bugs-hunts.json), or every class with `all`. Read-only. Prints each glob that
// matched no file and each risk with no guard, so a class never passes silently.
// Usage: bun scripts/bugs-hunt.ts <class|all>
import { BunRuntime } from '@effect/platform-bun'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Console, Effect } from 'effect'
import { runProc } from '../src/core/proc.ts'
import HUNTS from './bugs-hunts.json'

type Hunt = { readonly globs: ReadonlyArray<string>; readonly unguarded: ReadonlyArray<string> }

const ROOT = `${import.meta.dir}/..`
const hunts: Record<string, Hunt> = HUNTS

const report = (name: string, h: Hunt, found: ReadonlyArray<readonly [string, string[]]>) =>
  Effect.forEach(
    [
      ...found.filter(([, f]) => f.length === 0).map(([g]) => `no file matches ${g}`),
      ...h.unguarded.map((risk) => `not guarded yet: ${risk}`),
    ],
    (line) => Console.error(`bugs:${name}: ${line}`),
    { concurrency: 1 },
  )

const hunt = (name: string, h: Hunt) =>
  Effect.gen(function* () {
    const found = h.globs.map(
      (g) => [g, Array.from(new Bun.Glob(g).scanSync({ cwd: ROOT }))] as const,
    )
    yield* report(name, h, found)
    const files = found.flatMap(([, f]) => f.map((p) => `./${p}`))
    const argv: [string, ...string[]] = ['bun', 'test', '--timeout', '30000', ...files]
    const run = yield* runProc(argv, { timeoutMs: 600_000, cwd: ROOT })
    yield* Console.error(`bugs:${name}: ${run.stderr.trim().split('\n').slice(-4).join(' | ')}`)
    return run.code === 0 ? [] : [`bugs:${name}: tests failed`]
  })

const unknown = (name: string) => Effect.succeed([`unknown bug class ${name}`])

if (import.meta.main) {
  const arg = process.argv[2] ?? 'all'
  const names = arg === 'all' ? Object.keys(hunts) : [arg]
  Effect.forEach(names, (n) => (hunts[n] ? hunt(n, hunts[n]) : unknown(n)), {
    concurrency: 1,
  }).pipe(
    Effect.map((fails) => fails.flat()),
    Effect.flatMap((fails) => (fails.length === 0 ? Effect.void : Effect.fail(fails.join('\n')))),
    Effect.provide(BunServices.layer),
    BunRuntime.runMain,
  )
}
