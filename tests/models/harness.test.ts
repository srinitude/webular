// Gates for the three-model test: every scenario states its intent, outcome
// and eval; the baseline is recorded and still holds; every model run kept
// its raw output; the runner allows only the tools a surface needs and never
// runs in CI.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import type { ChildProcessSpawner } from 'effect/process'
import { ROOT } from '../_support/root.ts'
import { runBaseline, spawnText } from './baseline.ts'
import { evaluate, toolProblems } from './check.ts'
import { allowedTools, claudeArgs, claudeEnv } from './run.ts'
import { loadScenarios, type Scenario } from './scenarios.ts'

const Tools = Schema.fromJsonString(
  Schema.Struct({ tools: Schema.Record(Schema.String, Schema.Unknown) }),
)
const Results = Schema.fromJsonString(
  Schema.Struct({ runs: Schema.Array(Schema.Struct({ raw: Schema.String })) }),
)
const ctx = { origin: 'http://x', tmp: '/t' }

const run = <A>(
  body: (
    fs: FileSystem.FileSystem,
  ) => Effect.Effect<A, unknown, FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* body(yield* FileSystem.FileSystem)
    }).pipe(Effect.provide(BunServices.layer)),
  )

const flagsOf = (s: Scenario) =>
  s.reference.flatMap((step) => (Array.isArray(step) ? step.filter((a) => a.startsWith('--')) : []))

test('every scenario states intent, outcome and a code eval that rejects a wrong reply', () =>
  run(() =>
    Effect.map(loadScenarios, (file) => {
      const ids = file.scenarios.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toContain(file.smoke)
      for (const s of file.scenarios) {
        expect([s.id, s.intent.length > 20, s.outcome.length > 10, s.eval.kind]).toEqual([
          s.id,
          true,
          true,
          'code',
        ])
        expect([s.id, evaluate(s.eval, 'no answer here', ctx).length > 0]).toEqual([s.id, true])
      }
    }),
  ))

test('each scenario names a real command, MCP tool and flags (contract first)', () =>
  run((fs) =>
    Effect.gen(function* () {
      const file = yield* loadScenarios
      const tools = yield* Effect.flatMap(
        fs.readFileString(`${ROOT}plugins/webular/src/descriptions.json`),
        Schema.decodeUnknownEffect(Tools),
      )
      const shared = yield* fs.readFileString(`${ROOT}src/core/args.ts`)
      for (const s of file.scenarios.filter((x) => x.tool !== 'ReadMcpResourceTool')) {
        const src = shared + (yield* fs.readFileString(`${ROOT}src/commands/${s.tool}.ts`))
        expect([s.id, s.tool in tools.tools]).toEqual([s.id, true])
        for (const flag of flagsOf(s))
          expect([s.id, flag, src.includes(`${flag.slice(2)}:`)]).toEqual([
            s.id,
            flag,
            !(s.contractGaps ?? []).includes(flag),
          ])
      }
    }),
  ))

test(
  'every scenario has a recorded baseline, and a fresh run still matches it',
  () =>
    run(() =>
      Effect.gen(function* () {
        const file = yield* loadScenarios
        const fresh = yield* runBaseline(false)
        for (const s of file.scenarios) {
          expect([s.id, typeof s.baseline?.pass]).toEqual([s.id, 'boolean'])
          expect([s.id, fresh[s.id]?.pass]).toEqual([s.id, s.baseline?.pass])
        }
      }),
    ),
  120_000,
)

test('each surface allows only the tools it needs, with a turn cap and no bypass', () =>
  run(() =>
    Effect.map(loadScenarios, (file) => {
      expect(allowedTools('cli')).toEqual(['Bash(webular:*)', 'Bash(webular *)'])
      expect(allowedTools('mcp')).toEqual(['mcp__webular'])
      expect(allowedTools('plugin')).toEqual([
        'mcp__plugin_webular_webular',
        'Skill',
        'ReadMcpResourceTool',
        'ListMcpResourcesTool',
      ])
      const s = file.scenarios[0] as Scenario
      const args = claudeArgs(s, 'claude-haiku-5-5', 'cli', ctx, '/c')
      expect(args).toContain('--max-turns')
      expect(args).toContain('--strict-mcp-config')
      expect(args[args.indexOf('--tools') + 1]).toBe('Bash')
      expect(args.join(' ')).not.toContain('dangerously')
      expect(claudeArgs(s, 'claude-haiku-5-5', 'cli', ctx, '/c')).toEqual(args)
    }),
  ))

// A strict MCP config hides plugin servers, so the plugin run drops claude.ai
// connectors through its env instead.
test('the plugin surface loads the plugin and no claude.ai connectors', () =>
  run(() =>
    Effect.map(loadScenarios, (file) => {
      const s = file.scenarios[0] as Scenario
      const plugin = claudeArgs(s, 'claude-haiku-5-5', 'plugin', ctx, '/c')
      expect(plugin).toContain('--plugin-dir')
      expect(plugin).not.toContain('--strict-mcp-config')
      expect(plugin[plugin.indexOf('--tools') + 1]).toBe(
        'Skill,ReadMcpResourceTool,ListMcpResourcesTool',
      )
      expect(claudeEnv({}, '/bin')).toEqual({
        PATH: '/bin',
        CLAUDE_CODE_PLUGIN_DIRS: '',
        ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
      })
    }),
  ))

test('test:models stays out of CI and the default path', () =>
  run((fs) =>
    Effect.gen(function* () {
      const mise = yield* fs.readFileString(`${ROOT}mise.toml`)
      expect(mise).toContain('[tasks."test:models"]')
      expect(mise.split('[tasks."test:models"]')[0]).not.toContain('test:models')
      const flows = `${ROOT}.github/workflows`
      const names = (yield* fs.exists(flows)) ? yield* fs.readDirectory(flows) : []
      for (const f of names)
        expect(yield* fs.readFileString(`${flows}/${f}`)).not.toContain('test:models')
    }),
  ))

test('model runs are recorded and every run kept its raw output (evidence first)', () =>
  run((fs) =>
    Effect.gen(function* () {
      const dir = `${ROOT}tests/models/fixtures`
      const names = ((yield* fs.exists(dir)) ? yield* fs.readDirectory(dir) : []).filter((f) =>
        /^models-.*\.json$/.test(f),
      )
      expect(names.length).toBeGreaterThan(0)
      for (const f of names) {
        const { runs } = yield* Effect.flatMap(
          fs.readFileString(`${dir}/${f}`),
          Schema.decodeUnknownEffect(Results),
        )
        expect(runs.length).toBeGreaterThan(0)
        for (const r of runs) {
          const at = `${dir}/${r.raw.replace(/^bench\/results\//, '')}`
          expect([r.raw, yield* fs.exists(at)]).toEqual([r.raw, true])
        }
      }
    }),
  ))

test('answer-cites-source grades the outcome alone; other scenarios still need their tool', () =>
  run(() =>
    Effect.map(loadScenarios, (file) => {
      const byId = (id: string) => file.scenarios.find((s) => s.id === id) as Scenario
      const scraped = [{ name: 'Bash', input: { command: 'webular scrape --url x' } }]
      expect(toolProblems(byId('answer-cites-source'), scraped, 'cli')).toEqual([])
      expect(toolProblems(byId('scrape-reads-article'), [], 'cli')).toEqual([
        'never called scrape on the cli surface',
      ])
      expect(toolProblems(byId('scrape-reads-article'), scraped, 'cli')).toEqual([])
      const batched = [{ name: 'Bash', input: { command: 'webular batch --urls a,b' } }]
      expect(toolProblems(byId('batch-reads-urls-in-one-call'), batched, 'cli')).toEqual([])
      expect(
        toolProblems(byId('batch-reads-urls-in-one-call'), [...batched, ...scraped], 'cli'),
      ).toEqual(['called scrape where one batch call does the job'])
    }),
  ))

test('answer --urls is discoverable from the help text and the research skill', () =>
  run((fs) =>
    Effect.gen(function* () {
      const { out: help } = yield* spawnText('bun', [`${ROOT}bin/webular.ts`, '--help'], {})
      const skill = yield* fs.readFileString(
        `${ROOT}plugins/webular/skills/webular-research/SKILL.md`,
      )
      for (const text of [help, skill]) {
        expect(text).toContain('answer')
        expect(text).toContain('--urls')
      }
    }),
  ))
