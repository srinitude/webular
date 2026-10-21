// `mise run e2e`: every e2e case against one shared local fixture server.
// It prints the coverage counts and one pass/FAIL line per case, and exits
// non-zero when any case fails.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Duration, Effect, FileSystem, Option, Schema, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { startFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { CLI_CASES, type CliCase, PLUGIN_CASES, type PluginCase } from './cases.ts'
import { runMcp } from './mcp.ts'
import { e2eRoutes } from './routes.ts'
import { coverage, coverageRows } from './surface.ts'

const EXE = `${ROOT}dist/bin/webular${process.platform === 'win32' ? '.exe' : ''}`
const decodeObject = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
)

interface Result {
  code: number
  out: string
  err: string
}

const fixture = startFixture((o) => ({ ...defaultRoutes(o), ...e2eRoutes(o) }))

const argv = (c: CliCase, args: string[]): [string, string[]] => {
  if (c.via === 'bin') return ['bun', [`${ROOT}bin/webular.ts`, c.cmd, ...args]]
  if (c.via === 'exe') return [EXE, [c.cmd, ...args]]
  return ['bun', [`${ROOT}dist/commands/${c.cmd}.js`, ...args]]
}

const text = (s: Stream.Stream<Uint8Array, unknown>) => Stream.mkString(Stream.decodeText(s))

const spawn = (cmd: string, args: string[], env: Record<string, string>) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const h = yield* spawner.spawn(
      ChildProcess.make(cmd, args, { cwd: ROOT, env, extendEnv: true }),
    )
    const [out, err, code] = yield* Effect.all([text(h.stdout), text(h.stderr), h.exitCode], {
      concurrency: 3,
    })
    return { out, err, code: Number(code) } satisfies Result
  }).pipe(Effect.scoped)

const problems = (c: CliCase, r: Result, ms: number): string[] => [
  ...(r.code !== (c.code ?? 0) ? [`exit ${r.code} (want ${c.code ?? 0})`] : []),
  ...(c.err && !r.err.includes(c.err) ? [`stderr lacks "${c.err}"`] : []),
  ...(r.out.length > c.maxChars ? [`${r.out.length} chars > ${c.maxChars}`] : []),
  ...(ms > c.maxMs ? [`${Math.round(ms)}ms > ${c.maxMs}ms`] : []),
  ...(c.json && Option.isNone(decodeObject(r.out)) ? ['stdout is not one JSON object'] : []),
]

const runCase = (c: CliCase, fill: (s: string) => string, env: Record<string, string>) => {
  const [cmd, args] = argv(c, c.args.map(fill))
  return spawn(cmd, args, env).pipe(
    Effect.timed,
    Effect.map(([took, r]) => {
      const ms = Duration.toMillis(took)
      const bad = problems(c, r, ms)
      const label = `${c.via ?? 'bundle'} ${c.cmd}: ${c.name}`
      if (bad.length === 0) return `pass ${label} (${Math.round(ms)}ms, ${r.out.length} chars)`
      return `FAIL ${label}: ${bad.join('; ')} | stderr: ${r.err.trim().slice(0, 200)}`
    }),
    Effect.catch((e) => Effect.succeed(`FAIL ${c.cmd}: ${c.name}: ${String(e)}`)),
  )
}

const runPluginCase = (c: PluginCase, env: Record<string, string>) => {
  const [cmd = '', ...args] = c.argv
  if (c.needs && !Bun.which(c.needs))
    return Effect.succeed(`skip plugin: ${c.name} (${c.needs} not on PATH)`)
  return spawn(cmd, args, env).pipe(
    Effect.timed,
    Effect.map(([took, r]) =>
      r.code === 0
        ? `pass plugin: ${c.name} (${Math.round(Duration.toMillis(took))}ms)`
        : `FAIL plugin: ${c.name}: exit ${r.code} | ${(r.err || r.out).trim().slice(-300)}`,
    ),
    Effect.catch((e) => Effect.succeed(`FAIL plugin: ${c.name}: ${String(e)}`)),
  )
}

const envFor = (origin: string, tmp: string): Record<string, string> => ({
  WEBULAR_SOURCE_ORIGIN: origin,
  WEBULAR_DOCTOR_URL: `${origin}/a`,
  WEBULAR_INVOKE_DIR: tmp,
  WEBULAR_DB: `${tmp}/webular.db`,
  WEBULAR_NO_CACHE: '1',
})

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const fx = yield* fixture
  const tmp = yield* fs.makeTempDirectoryScoped()
  yield* fs.writeFileString(`${tmp}/note.md`, '# Note\n\nA short note for parse.\n')
  yield* fs.writeFileString(`${tmp}/urls.txt`, `${fx.origin}/a\n${fx.origin}/b\n`)
  const env = envFor(fx.origin, tmp)
  const fill = (s: string) => s.replaceAll('{origin}', fx.origin).replaceAll('{tmp}', tmp)
  const bundled = CLI_CASES.filter((c) => (c.via ?? 'bundle') === 'bundle')
  const routed = CLI_CASES.filter((c) => (c.via ?? 'bundle') !== 'bundle')
  const direct = yield* Effect.forEach(bundled, (c) => runCase(c, fill, env), { concurrency: 4 })
  const viaCli = yield* Effect.forEach(routed, (c) => runCase(c, fill, env), { concurrency: 4 })
  const cli = [...direct, ...viaCli]
  const mcp = yield* runMcp(fill, env)
  const plugin = yield* Effect.forEach(PLUGIN_CASES, (c) => runPluginCase(c, env), {
    concurrency: 1,
  })
  const rows = coverageRows(yield* coverage)
  const lines = [...cli, ...mcp, ...plugin]
  const failed = lines.filter((l) => l.startsWith('FAIL')).length
  yield* Console.log(lines.join('\n'))
  yield* Console.log(
    `coverage: ${rows.length} surfaces | cases: ${lines.length} | failed: ${failed}`,
  )
  if (failed > 0) return yield* Effect.fail(new Error(`${failed} e2e case(s) failed`))
})

main.pipe(Effect.scoped, Effect.provide(BunServices.layer), BunRuntime.runMain)
