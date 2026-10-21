// FAIL-FAST contract: a flag error exits within about 1 s of startup work that
// the error itself needs. Importing @mastra/core costs seconds of disk reads,
// so no command entry may load a heavy module before its flags validate.

import { describe, expect, test } from 'bun:test'
import { availableParallelism, loadavg } from 'node:os'
import { dirname, resolve } from 'node:path'
import { Duration, Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

// Modules that cost seconds to load, or pull in what does: the workflows (and
// through them Mastra and Jev), Mastra, TypeSafe, the MCP SDK, zod, linkedom.
const HEAVY = /^(@mastra\/|@typesafe|@modelcontextprotocol\/|zod$|linkedom$)|\/workflows\//

const transpiler = new Bun.Transpiler({ loader: 'ts' })

// The modules one file loads before its first line runs: static value
// imports only. Type-only and dynamic imports load nothing.
const loadsOf = (file: string, text: string) =>
  (file.endsWith('.json') ? [] : transpiler.scanImports(text))
    .filter((i) => i.kind === 'import-statement')
    .map(({ path }) => (path.startsWith('.') ? resolve(dirname(file), path) : path))

// Every heavy module an entry loads, followed through relative files.
const heavyImports = (entry: string) =>
  Effect.gen(function* () {
    const seen = new Set<string>()
    const heavy = new Set<string>()
    const queue = [entry]
    while (queue.length > 0) {
      const file = queue.pop() as string
      if (seen.has(file)) continue
      seen.add(file)
      const text = yield* io(() => Bun.file(file).text())
      const loads = loadsOf(file, text)
      for (const target of loads.filter((t) => HEAVY.test(t))) heavy.add(target)
      queue.push(...loads.filter((t) => t.startsWith('/') && !HEAVY.test(t)))
    }
    return [...heavy]
  })

// Each command's exit-2 case: a missing required argument.
const BAD_ARGS = [
  'act',
  'answer',
  'batch',
  'crawl',
  'extract',
  'feed',
  'map',
  'media',
  'monitor',
  'parse',
  'research',
  'scrape',
  'search',
  'summarize',
]

const median3 = (entry: string, args: string[]) =>
  Effect.gen(function* () {
    const runs = yield* Effect.forEach([1, 2, 3], () => Effect.timed(runCli(entry, args)), {
      concurrency: 1,
    })
    const ms = runs.map(([d]) => Duration.toMillis(d)).sort((a, b) => a - b)
    return { ms: ms[1] ?? 0, code: runs[0]?.[1].code }
  })

describe('failing commands exit fast', () => {
  test(
    'no command entry loads a heavy module before its flags validate',
    eff(
      Effect.gen(function* () {
        const files = [...new Bun.Glob('src/commands/*.ts').scanSync(ROOT)]
        const graphs = yield* Effect.forEach(files, (f) => heavyImports(`${ROOT}${f}`), {
          concurrency: 8,
        })
        const eager = files
          .map((file, i) => ({ file, heavy: graphs[i] ?? [] }))
          .filter((e) => e.heavy.length > 0)
        expect(eager).toEqual([])
      }),
    ),
    15_000,
  )

  test(
    'search with an unknown --source fails without loading Mastra',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runCli('src/commands/search.ts', ['bun', '--source', 'nope'])
        expect(code).toBe(2)
        expect(err).toContain('--source must be one of')
      }),
    ),
    15_000,
  )

  // The bound is 1 s past the floor: a process that loads only the Effect
  // runtime every command needs (src/core/effect.ts), timed in the same run.
  // A fixed 1 s fails on a loaded machine, where the floor alone took 1.2 s at
  // load average 176; a heavy import before the flag check adds seconds more
  // either way. The static graph check above is the exact guard. Past two
  // runnable processes per core the floor itself swings by seconds within one
  // run (load average 110 to 140 on 16 cores pushed lazy commands 2.5 s past
  // it), so the timing check skips there and the graph check stands alone.
  test.skipIf((loadavg()[0] ?? 0) / availableParallelism() > 2)(
    'every command exits on bad arguments within 1 s of the runtime floor',
    eff(
      Effect.gen(function* () {
        // The floor runs in the same batch, so it shares the same contention.
        const [floor, ...results] = yield* Effect.forEach(
          ['../core/effect', ...BAD_ARGS],
          (name) =>
            median3(`src/commands/${name}.ts`, []).pipe(Effect.map((r) => ({ name, ...r }))),
          { concurrency: 3 },
        )
        expect(results.filter((r) => r.code !== 2)).toEqual([])
        expect(results.filter((r) => r.ms > (floor?.ms ?? 0) + 1000)).toEqual([])
      }),
    ),
    240_000,
  )
})
