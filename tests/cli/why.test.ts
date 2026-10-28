// --why contract (why-spec sections 3, 4.3, 5, 7, 8): bare `webular --why` prints
// the fixed text offline with exit 0; per-command --why adds a `why` record from
// the payload the run holds, in human, --json, and --ndjson shapes.
import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import { GLOBAL_OPTIONS, helpText } from '../../src/cli/help.ts'
import { SCORE_LABEL, WHY_TEXT, whyBlock, whyRecord, withWhy } from '../../src/cli/why.ts'
import { formatOutput } from '../../src/core/output.ts'
import { runCli } from '../_support/cli.ts'
import { eff } from '../_support/run.ts'

const EXACT = `webular searches, reads, and answers
from the web, on your own machine.
No key needed. Jev is optional.

How it picks results:
  1. Asks several search sources at
     once.
  2. Merges their lists by weighted
     rank fusion.
  3. Adds pages you already read.
  4. Moves official sites up and
     aggregators down.
  5. Re-ranks web hits by word match.
  6. Lets Jev settle close calls when
     a Jev key is set.

See it for a real run:
  webular search "your query" --why
`

const STEP_IDS = ['sources', 'fusion', 'local-index', 'domain-signal', 'lexical-rerank', 'jev']

// A search payload in the recorded shape: openalex answered, wikipedia was empty.
const recorded = {
  query: 'bun runtime',
  count: 2,
  results: [
    { title: 'A', url: 'https://openalex.org/W1', description: 'a' },
    { title: 'B', url: 'https://doi.org/10.5281/zenodo.7945165', description: 'b' },
  ],
  meta: {
    sources: { openalex: { status: 'ok', ms: 5 }, wikipedia: { status: 'no-results', ms: 3 } },
    degraded: false,
    weak: false,
  },
}

const Bare = Schema.fromJsonString(
  Schema.Struct({
    kind: Schema.Literal('why'),
    tool: Schema.Literal('webular'),
    version: Schema.String,
    steps: Schema.Array(Schema.Struct({ id: Schema.String, text: Schema.String })),
    try: Schema.String,
  }),
)
const Json = Schema.fromJsonString(Schema.Unknown)

describe('per-command why record', () => {
  test('search: weighted rrf, k 60, results in output order, sources copied', () => {
    const out = withWhy('search', recorded) as { why: Record<string, unknown> }
    expect(out.why).toEqual({
      command: 'search',
      fusion: 'weighted-rrf',
      k: 60,
      query: 'bun runtime',
      results: [
        { url: 'https://openalex.org/W1', rank: 1 },
        { url: 'https://doi.org/10.5281/zenodo.7945165', rank: 2 },
      ],
      sources: recorded.meta.sources,
      weak: false,
    })
    expect(recorded).not.toHaveProperty('why')
  })

  test('commands that pick nothing: choices [] and the fixed human line', () => {
    expect(whyRecord('parse', {})).toEqual({ command: 'parse', choices: [] })
    expect(whyBlock(withWhy('parse', {}))).toBe('\nThis command made no ranking choices.')
    expect(whyRecord('answer', { sources: [] })).toMatchObject({ attribution: 'document' })
  })

  test(
    'ndjson ends with one {"why":...} line; human block is headed "Why these results:"',
    eff(
      Effect.gen(function* () {
        const data = withWhy('search', recorded)
        const lines = formatOutput(data, { ndjson: true, why: true }).split('\n')
        expect(lines).toHaveLength(3)
        const last = (yield* Schema.decodeUnknownEffect(Json)(lines[2])) as {
          why: { command: string }
        }
        expect(last.why.command).toBe('search')
        expect(formatOutput(recorded, { ndjson: true }).split('\n')).toHaveLength(2)
        expect(whyBlock(data)).toContain(
          `Why these results:\n${SCORE_LABEL}\n1. openalex.org\n2. doi.org`,
        )
        expect(whyBlock(data)).toContain('openalex ok 5ms')
      }),
    ),
  )
})

describe('webular --why and help', () => {
  test('help carries the spec option and usage lines', () => {
    expect(GLOBAL_OPTIONS).toContain('  --why             Show how results were picked')
    expect(helpText(Number.POSITIVE_INFINITY)).toContain('  webular --why   How webular works')
  })

  test('the bare text is the spec text, 40 columns or less', () => {
    expect(`${WHY_TEXT.join('\n')}\n`).toBe(EXACT)
    for (const line of WHY_TEXT) expect(line.length).toBeLessThanOrEqual(40)
  })

  test(
    'bare --why: exit 0, exact text; --json steps in order; --ndjson 7 lines; extras exit 2',
    eff(
      Effect.gen(function* () {
        const human = yield* runCli('bin/webular.ts', ['--why'])
        expect(human.code).toBe(0)
        expect(human.out).toBe(EXACT)
        const json = yield* runCli('bin/webular.ts', ['--why', '--json'])
        expect(json.code).toBe(0)
        const bare = yield* Schema.decodeUnknownEffect(Bare)(json.out)
        expect(bare.steps.map((s) => s.id)).toEqual(STEP_IDS)
        expect(bare.try).toBe('webular search "your query" --why')
        const nd = yield* runCli('bin/webular.ts', ['--why', '--ndjson'])
        const ndLines = nd.out.trim().split('\n')
        expect(ndLines).toHaveLength(7)
        for (const line of ndLines) yield* Schema.decodeUnknownEffect(Json)(line)
        const extra = yield* runCli('bin/webular.ts', ['--why', 'search', 'x'])
        expect(extra.code).toBe(2)
        expect(extra.err).toContain('--why goes after the command: webular search x --why')
        const valued = yield* runCli('src/commands/search.ts', ['x', '--why=1'])
        expect(valued.code).toBe(2)
      }),
    ),
    30_000,
  )
})

// The site hero line (design/webular-from-scratch/brief.json, hero-line) runs as written.
test(
  'hero line: $ webular --why exits 0',
  eff(
    Effect.gen(function* () {
      expect((yield* runCli('bin/webular.ts', ['--why'])).code).toBe(0)
    }),
  ),
  15_000,
)

describe('per-command --why runs', () => {
  const parse = (args: string[]) => runCli('src/commands/parse.ts', args)
  const file = 'tests/fixtures/crossref-works.json'
  const Parsed = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))
  test(
    'parse: why.choices is [], the rest is unchanged, and exit codes match',
    eff(
      Effect.gen(function* () {
        const plain = yield* parse(['--file', file, '--json'])
        const run = yield* parse(['--file', file, '--json', '--why'])
        expect(run.code).toBe(plain.code)
        const { why, ...rest } = yield* Schema.decodeUnknownEffect(Parsed)(run.out)
        expect(why).toEqual({ command: 'parse', choices: [] })
        expect(rest).toEqual(yield* Schema.decodeUnknownEffect(Parsed)(plain.out))
        const missing = yield* parse(['--file', 'tests/fixtures/no-such-file.json', '--json'])
        const missingWhy = yield* parse(['--file', 'tests/fixtures/no-such-file.json', '--why'])
        expect(missingWhy.code).toBe(missing.code)
      }),
    ),
    30_000,
  )
})
