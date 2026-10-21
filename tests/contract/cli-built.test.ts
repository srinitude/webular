// Agent contract against the BUILT CLI (dist/bin/webular, from `mise run
// build`), not the source: discovery through --help, the fixed exit codes for
// usage (2) and failure (1) with a `--help` hint, and --json that decodes with
// each command's workflow output schema. tests/contract/cli.test.ts covers the
// same clauses from src/.

import { describe, expect, test } from 'bun:test'
import type { AnyWorkflow } from '@mastra/core/workflows'
import { Effect, Schema, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { COMMAND_NAMES } from '../../src/cli/commands.ts'
import { useFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

const EXE = `${ROOT}dist/bin/webular${process.platform === 'win32' ? '.exe' : ''}`

const PAGE = '<html><head><title>Fixture</title></head><body><h1>Hello</h1><p>Hi.</p></body></html>'
const fx = useFixture(() => ({
  '/': () => new Response(PAGE, { headers: { 'content-type': 'text/html' } }),
}))

const text = <E>(s: Stream.Stream<Uint8Array, E>) => Stream.mkString(Stream.decodeText(s))

// The built executable, with Jev and the HTTP disk cache off.
const exe = (args: string[]) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const h = yield* spawner.spawn(
        ChildProcess.make(EXE, args, {
          cwd: ROOT,
          env: { WEBULAR_JEV: 'off', WEBULAR_NO_CACHE: '1' },
          extendEnv: true,
        }),
      )
      const [out, err, code] = yield* Effect.all([text(h.stdout), text(h.stderr), h.exitCode], {
        concurrency: 3,
      })
      return { code: Number(code), out, err }
    }),
  )

test('the built executable exists (run `mise run build` first)', () => {
  expect(Bun.file(EXE).size).toBeGreaterThan(0)
})

describe('built CLI: discovery through --help', () => {
  test(
    'webular --help lists every command',
    eff(
      Effect.gen(function* () {
        const r = yield* exe(['--help'])
        expect(r.code).toBe(0)
        for (const cmd of COMMAND_NAMES) expect(r.out).toContain(cmd)
      }),
    ),
    30_000,
  )
  for (const cmd of COMMAND_NAMES) {
    test(
      `webular ${cmd} --help`,
      eff(
        Effect.gen(function* () {
          const r = yield* exe([cmd, '--help'])
          expect(r.code).toBe(0)
          expect(r.out).toContain(`webular ${cmd}`)
        }),
      ),
      30_000,
    )
  }
})

// Each wrong run, its fixed exit code, and the start of its stderr.
// Every message's last line names the next step: --help for usage, doctor for
// a failed run.
const ERROR_RUNS: { name: string; args: string[]; code: number; starts: string }[] = [
  { name: 'unknown command', args: ['scrap'], code: 2, starts: '' },
  {
    name: 'unknown flag',
    args: ['scrape', '--no-such-flag'],
    code: 2,
    starts: "scrape: unknown option '--no-such-flag'.",
  },
  { name: 'missing input', args: ['scrape'], code: 2, starts: 'scrape: missing' },
  {
    name: 'ftp address',
    args: ['map', 'ftp://example.com'],
    code: 2,
    starts: "map: 'ftp://example.com' is not a web address.",
  },
  {
    name: 'text that is not an address',
    args: ['scrape', '--url', 'not a url'],
    code: 2,
    starts: "scrape: 'not a url' is not a web address.",
  },
  {
    name: 'unreachable URL',
    args: ['scrape', '--url', 'http://127.0.0.1:9/'],
    code: 1,
    // No stack trace comes first: the failure line opens stderr.
    starts: 'scrape: failed (',
  },
]

describe('built CLI: fixed exit codes with a --help hint', () => {
  for (const run of ERROR_RUNS) {
    test(
      `${run.name} exits ${run.code}`,
      eff(
        Effect.gen(function* () {
          const r = yield* exe(run.args)
          expect(r.code).toBe(run.code)
          expect(r.err).toStartWith(run.starts)
          const last = r.err.trim().split('\n').at(-1) ?? ''
          expect(last).toMatch(/Run 'webular (\w+ )?(--help|doctor)'/)
        }),
      ),
      30_000,
    )
  }
})

const JSON_RUNS: Record<string, (origin: string) => string[]> = {
  scrape: (o) => ['--url', `${o}/`],
  map: (o) => ['--url', `${o}/`],
  extract: (o) => ['--url', `${o}/`, '--selector', 'h1'],
  monitor: (o) => ['--url', `${o}/`],
}

const decodeWith = (workflow: AnyWorkflow) =>
  Schema.decodeUnknownEffect(
    Schema.fromJsonString(
      Schema.declare((u: unknown): u is unknown => {
        const result = workflow.outputSchema['~standard'].validate(u)
        return !(result instanceof Promise) && result.issues === undefined
      }),
    ),
  )

describe('built CLI: --json decodes with the workflow output schema', () => {
  for (const [cmd, args] of Object.entries(JSON_RUNS)) {
    test(
      `webular ${cmd} --json`,
      eff(
        Effect.gen(function* () {
          const r = yield* exe([cmd, ...args(fx.origin), '--json'])
          expect(r.err).toBe('')
          expect(r.code).toBe(0)
          const mod = yield* io(() => import(`../../src/workflows/${cmd}.ts`))
          yield* decodeWith(mod[`${cmd}Workflow`] as AnyWorkflow)(r.out)
        }),
      ),
      30_000,
    )
  }
})
