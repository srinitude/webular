// Agent contract for every CLI command: --help prints usage naming the
// command (exit 0); an unknown flag or missing input is a usage error (exit 2)
// whose message starts with "<cmd>:" and says what to do; URL commands print
// --json that decodes with their workflow's declared output schema, checked
// against a local fixture server.

import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { AnyWorkflow } from '@mastra/core/workflows'
import { Effect, Schema } from 'effect'
import { COMMAND_NAMES } from '../../src/cli/commands.ts'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff, io, tmpDir } from '../_support/run.ts'

const cli = (cmd: string, args: string[]) => runCli(`src/commands/${cmd}.ts`, args)

const PAGE =
  '<html><head><title>Fixture</title></head><body><h1>Hello</h1><p>Plain text here.</p></body></html>'
const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture RSS</title>
<item><title>One</title><link>https://example.com/1</link><description>First</description></item>
</channel></rss>`
const typed = (body: BodyInit, type: string) => () =>
  new Response(body, { headers: { 'content-type': type } })
const fx = useFixture(() => ({
  '/': typed(PAGE, 'text/html'),
  '/rss.xml': typed(RSS, 'application/rss+xml'),
  '/img.png': typed(new Uint8Array(64), 'image/png'),
}))

// Commands with no required input run real work with no flags, so only the
// unknown-flag half of the usage check applies to them.
const NO_REQUIRED_INPUT = new Set(['doctor', 'tasks', 'mcp', 'diagram', 'audit'])

describe('every command honors --help and usage errors', () => {
  for (const cmd of COMMAND_NAMES) {
    test(
      `${cmd}: --help, unknown flag, missing input`,
      eff(
        Effect.gen(function* () {
          const help = yield* cli(cmd, ['--help'])
          expect(help.code).toBe(0)
          expect(help.out).toContain(`webular ${cmd}`)
          const bad = yield* cli(cmd, ['--no-such-flag'])
          expect(bad.code).toBe(2)
          expect(bad.err).toStartWith(`${cmd}: unknown option '--no-such-flag'. Run 'webular`)
          if (NO_REQUIRED_INPUT.has(cmd)) return
          const missing = yield* cli(cmd, [])
          expect(missing.code).toBe(2)
          expect(missing.err).toMatch(new RegExp(`^${cmd}: missing .*(Pass|--)`))
        }),
      ),
      30_000,
    )
  }
})

// Network-only or host-tool commands skip the JSON check: search and research
// call live search providers, act drives a real browser, audit and doctor
// inspect host tools, mcp serves stdio. parse reads local files, not URLs.
const JSON_RUNS: Record<string, (origin: string, dir: string) => string[]> = {
  scrape: (o) => ['--url', `${o}/`],
  map: (o) => ['--url', `${o}/`],
  crawl: (o) => ['--url', `${o}/`, '--limit', '1'],
  extract: (o) => ['--url', `${o}/`, '--selector', 'h1'],
  summarize: (o) => ['--url', `${o}/`],
  batch: (o) => ['--urls', `${o}/`],
  monitor: (o) => ['--url', `${o}/`],
  answer: (o) => ['--query', 'hello', '--urls', `${o}/`],
  feed: (o) => ['--url', `${o}/rss.xml`],
  media: (o, dir) => ['--url', `${o}/img.png`, '-o', join(dir, 'media.bin')],
}

// Each command's contract is its workflow's outputSchema: src/workflows/<cmd>.ts
// exports <cmd>Workflow, built from a Standard Schema (zod) that this wraps as
// an Effect Schema over the JSON text.
const workflowOf = (cmd: string) =>
  Effect.map(
    io(() => import(`../../src/workflows/${cmd}.ts`)),
    (mod) => mod[`${cmd}Workflow`] as AnyWorkflow,
  )
const decodeWith = (workflow: AnyWorkflow) =>
  Schema.decodeUnknownEffect(
    Schema.fromJsonString(
      Schema.declare((u: unknown): u is unknown => {
        const result = workflow.outputSchema['~standard'].validate(u)
        return !(result instanceof Promise) && result.issues === undefined
      }),
    ),
  )

describe('URL commands print --json matching their output schema', () => {
  for (const [cmd, args] of Object.entries(JSON_RUNS)) {
    test(
      `${cmd} --json`,
      eff(
        Effect.gen(function* () {
          const dir = yield* tmpDir('webular-contract-')
          const run = yield* cli(cmd, [...args(fx.origin, dir), '--json'])
          expect(run.err).toBe('')
          expect(run.code).toBe(0)
          yield* decodeWith(yield* workflowOf(cmd))(run.out)
        }),
      ),
      30_000,
    )
  }
})
