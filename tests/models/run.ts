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
import { spawnText } from './baseline.ts'
import { type Ctx, evaluate, fill, toolProblems } from './check.ts'
import { type Job, jobsFor } from './jobs.ts'
import { parseStream, summary } from './report.ts'
import {
  fixtureRoutes,
  loadScenarios,
  type Scenario,
  type Surface,
  webularEnv,
} from './scenarios.ts'

const ALLOWED: Record<Surface, string[]> = {
  cli: ['Bash(webular:*)', 'Bash(webular *)'],
  mcp: ['mcp__webular'],
  plugin: ['mcp__plugin_webular_webular', 'Skill', 'ReadMcpResourceTool', 'ListMcpResourcesTool'],
}
export const allowedTools = (surface: Surface) => ALLOWED[surface]

// Built-in tools the run can see at all; MCP tools come from the config or plugin.
const BUILTIN: Record<Surface, string> = {
  cli: 'Bash',
  mcp: 'ReadMcpResourceTool,ListMcpResourcesTool',
  plugin: 'Skill,ReadMcpResourceTool,ListMcpResourcesTool',
}

const HINT: Record<Surface, string> = {
  cli: 'Use the `webular` command line tool (it is on PATH; `webular --help` lists its commands; add --json for JSON output).',
  mcp: 'Use the webular MCP server tools.',
  plugin: 'Use the webular plugin: its MCP tools and skills.',
}

export const claudeArgs = (
  s: Scenario,
  model: string,
  surface: Surface,
  ctx: Ctx,
  mcpConfig: string,
  turns = 10,
) => [
  '-p',
  `${HINT[surface]} ${fill(s.prompt, ctx)}`,
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
  // The plugin brings its own MCP server and a strict MCP config hides it, so
  // claudeEnv keeps claude.ai connectors out of the plugin surface instead.
  ...(surface === 'plugin'
    ? ['--plugin-dir', `${ROOT}plugins/webular`]
    : ['--strict-mcp-config', '--mcp-config', mcpConfig]),
  '--tools',
  BUILTIN[surface],
  '--allowedTools',
  ALLOWED[surface].join(','),
]

// The child's env: no plugin but the one under test, and no claude.ai connectors.
export const claudeEnv = (env: Record<string, string>, path: string) => ({
  ...env,
  PATH: path,
  CLAUDE_CODE_PLUGIN_DIRS: '',
  ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
})

const mcpServers = (surface: Surface, env: Record<string, string>) =>
  surface === 'mcp'
    ? { webular: { command: 'bun', args: [`${ROOT}src/commands/mcp.ts`], env } }
    : {}

// One headless claude run in its own temp folder, against its own fixture.
const spawnClaude = ({ file, s, model, surface }: Job, ctx: Ctx, env: Record<string, string>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Config.String('PATH').pipe(Config.withDefault(''))
    const binDir = yield* Config.String('WEBULAR_BIN_DIR').pipe(
      Config.withDefault(`${ROOT}dist/bin`),
    )
    yield* fs.writeFileString(
      `${ctx.tmp}/mcp.json`,
      JSON.stringify({ mcpServers: mcpServers(surface, env) }),
    )
    const args = claudeArgs(s, model, surface, ctx, `${ctx.tmp}/mcp.json`, file.defaults.maxTurns)
    const childEnv = claudeEnv(env, `${binDir}:${path}`)
    const limit = Duration.seconds(s.timeoutSec ?? file.defaults.timeoutSec)
    return yield* spawnText('claude', args, childEnv, ctx.tmp).pipe(
      Effect.timeoutOption(limit),
      Effect.timed,
    )
  })

const runOne = (job: Job) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const fx = yield* startFixture(fixtureRoutes(job.file))
    const ctx = { origin: fx.origin, tmp: yield* fs.makeTempDirectoryScoped() }
    const [took, out] = yield* spawnClaude(job, ctx, webularEnv(ctx.origin, ctx.tmp))
    const raw = Option.match(out, { onNone: () => '', onSome: (r) => `${r.out}\n${r.err}` })
    yield* fs.writeFileString(`${ROOT}${job.rawPath}`, raw.replaceAll(fx.origin, '{origin}'))
    const { uses, result } = parseStream(raw)
    const problems = [
      ...(Option.isNone(out) ? ['timed out'] : []),
      ...(result?.is_error ? ['claude reported an error'] : []),
      ...toolProblems(job.s, uses, job.surface),
      ...evaluate(job.s.eval, result?.result ?? '', ctx),
    ]
    const { model, surface, rawPath: raw_ } = job
    return {
      model,
      surface,
      scenario: job.s.id,
      pass: problems.length === 0,
      problems,
      turns: result?.num_turns ?? null,
      wallMs: Math.round(Duration.toMillis(took)),
      raw: raw_,
    }
  }).pipe(Effect.scoped)

const FLAGS = {
  smoke: { type: 'boolean' },
  models: { type: 'string' },
  surfaces: { type: 'string' },
  scenarios: { type: 'string' },
} as const

const main = Effect.gen(function* () {
  const { values } = parseArgs({ options: FLAGS })
  const file = yield* loadScenarios
  const fs = yield* FileSystem.FileSystem
  const stamp = new Date(yield* Clock.currentTimeMillis).toISOString()
  const date = stamp.slice(0, 10)
  // Time and pid keep parallel runs from writing over each other's files.
  const name = `models-${date}${values.smoke ? '-smoke' : ''}-${stamp.slice(11, 19).replaceAll(':', '')}-${process.pid}`
  yield* fs.makeDirectory(`${ROOT}bench/results/raw/${name}`, { recursive: true })
  const rows = yield* Effect.forEach(
    jobsFor(file, name, values.smoke === true, values),
    (job) =>
      Effect.tap(runOne(job), (r) =>
        Console.log(
          `${r.pass ? 'pass' : 'FAIL'} ${r.model} ${r.surface} ${r.scenario} ${r.problems.join('; ')}`,
        ),
      ),
    { concurrency: 1 },
  )
  yield* fs.writeFileString(
    `${ROOT}bench/results/${name}.json`,
    `${JSON.stringify({ date, runs: rows }, null, 2)}\n`,
  )
  yield* fs.writeFileString(`${ROOT}bench/results/${name}.md`, summary(date, rows))
  yield* Console.log(`wrote bench/results/${name}.json and .md`)
}).pipe(Effect.provide(BunServices.layer))

if (import.meta.main) BunRuntime.runMain(main)
