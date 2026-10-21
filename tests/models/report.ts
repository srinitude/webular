// Reading one headless claude run's stream-json output, and the Markdown
// summary of a model matrix.
import { Option, Schema } from 'effect'
import type { ToolUse } from './check.ts'

const Line = Schema.fromJsonString(Schema.Unknown)
const Use = Schema.Struct({
  type: Schema.Literal('tool_use'),
  name: Schema.String,
  input: Schema.Unknown,
})
const Assistant = Schema.Struct({
  type: Schema.Literal('assistant'),
  message: Schema.Struct({ content: Schema.Array(Schema.Unknown) }),
})
const Result = Schema.Struct({
  type: Schema.Literal('result'),
  result: Schema.optional(Schema.String),
  num_turns: Schema.optional(Schema.Number),
  duration_ms: Schema.optional(Schema.Number),
  is_error: Schema.optional(Schema.Boolean),
})

export const parseStream = (raw: string) => {
  const events = raw.split('\n').flatMap((l) => Option.toArray(Schema.decodeUnknownOption(Line)(l)))
  const uses: ToolUse[] = events
    .filter(Schema.is(Assistant))
    .flatMap((e) => e.message.content.filter(Schema.is(Use)))
  const result = events.filter(Schema.is(Result)).at(-1)
  return { uses, result }
}

interface Row {
  model: string
  surface: string
  scenario: string
  pass: boolean
  problems: readonly string[]
  turns: number | null
  wallMs: number
}

export const summary = (date: string, rows: readonly Row[]) =>
  [
    `# Model matrix ${date}`,
    '',
    `${rows.filter((r) => r.pass).length} of ${rows.length} runs pass.`,
    '',
    '| Model | Surface | Scenario | Result | Turns | Seconds |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.model} | ${r.surface} | ${r.scenario} | ${r.pass ? 'pass' : `fail: ${r.problems.join('; ')}`} | ${r.turns ?? '-'} | ${Math.round(r.wallMs / 1000)} |`,
    ),
    '',
  ].join('\n')
