// Guard: the AGENTS.md rules that one grep can decide. Each pattern must find
// no line in its paths. Rules the code still breaks are not listed here.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

type Gate = readonly [rule: string, pattern: string, ...paths: string[]]

const ZOD_OLD =
  "from 'zod/(v3|v4|mini)'|\\.strict\\(\\)|\\.passthrough\\(\\)|\\.merge\\(|z\\.string\\(\\)\\.(email|uuid|url|datetime)"

const GATES: ReadonlyArray<Gate> = [
  [
    'decode JSON with a schema, not a cast',
    'JSON\\.parse\\(.*\\)[[:space:]]+as[[:space:]]',
    'src/*.ts',
    'plugins/webular/*.ts',
  ],
  [
    'graph helpers come from xstate/graph',
    '@xstate/graph',
    'package.json',
    'tests/*.ts',
    ':!tests/quality/rule-greps.test.ts',
  ],
  ['zod 4 names only', ZOD_OLD, 'src/*.ts', 'plugins/webular/src/*.ts'],
  ['tests bind port 0', 'port: ?[1-9]', 'tests/*.ts'],
  [
    'Readability runs only in src/lib/html.ts',
    'new Readability\\(|isProbablyReaderable\\(',
    'src/*.ts',
    ':!src/lib/html.ts',
  ],
  [
    'no layout reads in linkedom',
    'getComputedStyle|getBoundingClientRect|offsetWidth|offsetHeight',
    'src/*.ts',
  ],
  ['no untrusted workflow triggers', 'pull_request_target|workflow_run', '.github/*.yml'],
  [
    'no retired Effect names',
    'Effect\\.fork\\(|forkDaemon|Context\\.Tag|GenericTag|makeSemaphore',
    'src/*.ts',
  ],
  ['connection pooling stays on', 'keepalive: false', 'src/*.ts'],
  ['machine config is declarative', 'guard: \\(|actions: \\[?\\(|entry: \\(', 'src/machines/*.ts'],
  [
    'the plugin uses only the MCP server package',
    "from '@modelcontextprotocol/sdk",
    'plugins/webular/src/*.ts',
    'plugins/webular/tests/*.ts',
  ],
  // git grep caps one repeat count at 255, so 501 characters is split.
  [
    'skill compatibility stays at or under 500 characters',
    '^compatibility: .{250}.{251}',
    'plugins/webular/skills/*/SKILL.md',
  ],
]

// git grep exits 1 for no match and 2 for a bad pattern or path.
const hits = ([rule, pattern, ...paths]: Gate) =>
  runProc(['git', 'grep', '-nE', pattern, '--', ...paths], { timeoutMs: 10_000, cwd: ROOT }).pipe(
    Effect.map(({ code, stdout }) =>
      code > 1
        ? [`${rule}: git grep failed`]
        : stdout
            .split('\n')
            .filter(Boolean)
            .map((line) => `${rule}: ${line}`),
    ),
  )

describe('AGENTS.md grep gates', () => {
  test(
    'every grep gate finds nothing',
    eff(
      Effect.map(Effect.forEach(GATES, hits, { concurrency: 4 }), (found) =>
        expect(found.flat()).toEqual([]),
      ),
    ),
    30_000,
  )

  test(
    'a gate reports a hit',
    eff(
      Effect.map(hits(['probe', 'createMachine\\(', 'src/*.ts']), (found) =>
        expect(found.length).toBeGreaterThan(0),
      ),
    ),
  )
})
