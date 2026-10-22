// `mise run test:models`: run each scenario through headless Claude Code on
// the logged-in subscription, for each model and surface, and write the
// model x surface x scenario matrix to bench/results/models-<date>.json plus a
// Markdown summary. Every run keeps its raw stream-json output under
// bench/results/raw/. Runs go one at a time to respect usage limits. Never CI.
//   --smoke                 the smoke scenario, CLI surface, every model
//   --models a,b --surfaces cli,mcp --scenarios id,id   narrow the grid
import { parseArgs } from 'node:util'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Clock, Config, Console, Duration, Effect, FileSystem, Option } from 'effect'
import { startFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { allowedTools, armKeys, builtinTools, hint, peerServer, WEBULAR } from './agent/arm.ts'
import { grade } from './agent/judge.ts'
import { RATES_SOURCE } from './agent/rates.ts'
import { rowOf } from './agent/row.ts'
import { agentTasks } from './agent/tasks.ts'
import { spawnText } from './baseline.ts'
import { type Ctx, fill, peerProblems, toolProblems } from './check.ts'
import { ARM_SEED, type Job, jobsFor } from './jobs.ts'
import { parseStream, summary, withPassK } from './report.ts'
import {
  fixtureRoutes,
  loadScenarios,
  type Scenario,
  type Surface,
  webularEnv,
} from './scenarios.ts'

export { allowedTools }

// The plugin brings its own MCP server and a strict MCP config hides it, so
// claudeEnv keeps claude.ai connectors out of the plugin surface instead.
const mcpFlags = (surface: Surface, mcpConfig: string) =>
  surface === 'plugin'
    ? ['--plugin-dir', `${ROOT}plugins/webular`]
    : ['--strict-mcp-config', '--mcp-config', mcpConfig]

export const claudeArgs = (
  s: Scenario,
  model: string,
  surface: Surface,
  ctx: Ctx,
  mcpConfig: string,
  turns = 10,
  provider = WEBULAR,
) => [
  '-p',
  `${hint(surface, provider)} ${fill(s.prompt, ctx)}`,
  '--model',
  model,
  '--output-format',
  'stream-json',
  '--verbose',
  '--max-turns',
  String(s.maxTurns ?? turns),
  '--setting-sources',
  'project',
  '--no-session-persistence',
  ...mcpFlags(surface, mcpConfig),
  '--tools',
  builtinTools(surface),
  '--allowedTools',
  allowedTools(surface, provider).join(','),
  // The arm's tool is the only way to the web.
  '--disallowedTools',
  'WebSearch,WebFetch',
]

// The child's env: no plugin but the one under test, and no claude.ai connectors.
export const claudeEnv = (env: Record<string, string>, path: string) => ({
  ...env,
  PATH: path,
  CLAUDE_CODE_PLUGIN_DIRS: '',
  ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
})

const mcpServers = ({ surface, peer }: Job, env: Record<string, string>) =>
  peer
    ? peerServer(peer)
    : surface === 'mcp'
      ? { webular: { command: 'bun', args: [`${ROOT}src/commands/mcp.ts`], env } }
      : {}

// One headless claude run in its own temp folder, against its own fixture.
const spawnClaude = (job: Job, ctx: Ctx, env: Record<string, string>, keys: Keys) =>
  Effect.gen(function* () {
    const { file, s, model, surface, provider } = job
    const fs = yield* FileSystem.FileSystem
    const path = yield* Config.String('PATH').pipe(Config.withDefault(''))
    const binDir = yield* Config.String('WEBULAR_BIN_DIR').pipe(
      Config.withDefault(`${ROOT}dist/bin`),
    )
    yield* fs.writeFileString(
      `${ctx.tmp}/mcp.json`,
      JSON.stringify({ mcpServers: mcpServers(job, env) }),
    )
    const mcp = `${ctx.tmp}/mcp.json`
    const args = claudeArgs(s, model, surface, ctx, mcp, file.defaults.maxTurns, provider)
    // Keys live only in the child env; the config refers to them by name.
    const childEnv = claudeEnv({ ...env, ...keys }, `${binDir}:${path}`)
    const limit = Duration.seconds(s.timeoutSec ?? file.defaults.timeoutSec)
    return yield* spawnText('claude', args, childEnv, ctx.tmp).pipe(
      Effect.timeoutOption(limit),
      Effect.timed,
    )
  })

type Keys = Record<string, string>

// A public-web task has no local reference call, so webular reaches the real
// web instead of the 127.0.0.1 fixture.
const armEnv = (job: Job, ctx: Ctx) => {
  const { WEBULAR_SOURCE_ORIGIN: _, ...web } = webularEnv(ctx.origin, ctx.tmp)
  return job.s.reference.length ? { ...web, WEBULAR_SOURCE_ORIGIN: ctx.origin } : web
}

const runOne = (job: Job, keys: Keys) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const fx = yield* startFixture(fixtureRoutes(job.file))
    const ctx = { origin: fx.origin, tmp: yield* fs.makeTempDirectoryScoped() }
    const [took, out] = yield* spawnClaude(job, ctx, armEnv(job, ctx), keys)
    const raw = Option.match(out, { onNone: () => '', onSome: (r) => `${r.out}\n${r.err}` })
    yield* fs.writeFileString(`${ROOT}${job.rawPath}`, raw.replaceAll(fx.origin, '{origin}'))
    const run = parseStream(raw)
    const reply = run.result?.result ?? ''
    const problems = [
      ...(Option.isNone(out) ? ['timed out'] : []),
      ...(run.result?.is_error ? ['claude reported an error'] : []),
      ...(job.peer
        ? peerProblems(job.s, run.uses, job.provider)
        : toolProblems(job.s, run.uses, job.surface)),
      ...(yield* grade(job.s, job.s.eval, reply, ctx)),
    ]
    return rowOf(job, problems, run, Math.round(Duration.toMillis(took)))
  }).pipe(Effect.scoped)

// A peer arm or the Jev-on arm with a missing key is skipped with a clear reason, never run.
const runArm = (job: Job) =>
  Effect.gen(function* () {
    const { env, missing } = yield* armKeys(job.peer, job.provider)
    if (missing.length === 0) return yield* runOne(job, env)
    return rowOf(job, [`skipped: no key (${missing.join(', ')})`], parseStream(''), 0)
  })

const FLAGS = {
  smoke: { type: 'boolean' },
  models: { type: 'string' },
  surfaces: { type: 'string' },
  scenarios: { type: 'string' },
  providers: { type: 'string' },
  // The agent track: frozen tasks (or the inline sample) on every arm, peers included.
  agent: { type: 'boolean' },
  repeats: { type: 'string' },
  // The arm-order seed; the same seed repeats the same order per model and task.
  seed: { type: 'string' },
} as const

const logRow = (r: ReturnType<typeof rowOf>) =>
  Console.log(
    `${r.pass ? 'pass' : 'FAIL'} ${r.model} ${r.surface} ${r.provider} ${r.task} ${r.problems.join('; ')}`,
  )

// Time and pid keep parallel runs from writing over each other's files.
const runName = (stamp: string, smoke: boolean | undefined) =>
  `models-${stamp.slice(0, 10)}${smoke ? '-smoke' : ''}-${stamp.slice(11, 19).replaceAll(':', '')}-${process.pid}`

const main = Effect.gen(function* () {
  const { values } = parseArgs({ options: FLAGS })
  const loaded = yield* loadScenarios
  const file = values.agent ? { ...loaded, scenarios: yield* agentTasks(loaded) } : loaded
  const repeats = Math.max(1, Number(values.repeats ?? 1) || 1)
  const surfaces = values.surfaces ?? (values.agent ? `${file.surfaces.join(',')},peer` : undefined)
  const fs = yield* FileSystem.FileSystem
  const stamp = new Date(yield* Clock.currentTimeMillis).toISOString()
  const date = stamp.slice(0, 10)
  const name = runName(stamp, values.smoke)
  yield* fs.makeDirectory(`${ROOT}bench/results/raw/${name}`, { recursive: true })
  const jobs = jobsFor(file, name, values.smoke === true, { ...values, surfaces }, repeats)
  const runs = yield* Effect.forEach(jobs, (job) => Effect.tap(runArm(job), logRow), {
    concurrency: 1,
  })
  const rows = withPassK(runs, repeats)
  yield* fs.writeFileString(
    `${ROOT}bench/results/${name}.json`,
    `${JSON.stringify({ date, seed: values.seed ?? ARM_SEED, rates: RATES_SOURCE, runs: rows }, null, 2)}\n`,
  )
  yield* fs.writeFileString(`${ROOT}bench/results/${name}.md`, summary(date, rows))
  yield* Console.log(`wrote bench/results/${name}.json and .md`)
}).pipe(Effect.provide(BunServices.layer))

if (import.meta.main) BunRuntime.runMain(main)
