// Reading one headless claude run's stream-json output, and the Markdown
// summary of a model matrix.
import { Option, Schema } from 'effect'
import type { Usage } from './agent/rates.ts'
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
const Tokens = Schema.optional(Schema.Number)
const Result = Schema.Struct({
  type: Schema.Literal('result'),
  result: Schema.optional(Schema.String),
  num_turns: Schema.optional(Schema.Number),
  duration_ms: Schema.optional(Schema.Number),
  is_error: Schema.optional(Schema.Boolean),
  usage: Schema.optional(
    Schema.Struct({
      input_tokens: Tokens,
      output_tokens: Tokens,
      cache_read_input_tokens: Tokens,
      cache_creation_input_tokens: Tokens,
    }),
  ),
})

export const parseStream = (raw: string) => {
  const events = raw.split('\n').flatMap((l) => Option.toArray(Schema.decodeUnknownOption(Line)(l)))
  const uses: ToolUse[] = events
    .filter(Schema.is(Assistant))
    .flatMap((e) => e.message.content.filter(Schema.is(Use)))
  const result = events.filter(Schema.is(Result)).at(-1)
  const u = result?.usage
  const usage: Usage = {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
  }
  return { uses, result, usage }
}

interface Row {
  model: string
  surface: string
  provider: string
  task: string
  pass: boolean
  problems: readonly string[]
  turns: number | null
  wallMs: number
}

// pass^k: a task counts only when every repeat of it passed.
export const withPassK = <R extends Row>(rows: readonly R[], repeats: number) => {
  if (repeats < 2) return rows
  const key = (r: Row) => `${r.model}|${r.surface}|${r.provider}|${r.task}`
  const failed = new Set(rows.filter((r) => !r.pass).map(key))
  return rows.map((r) => ({ ...r, passK: { k: repeats, pass: !failed.has(key(r)) } }))
}

export const summary = (date: string, rows: readonly Row[]) =>
  [
    `# Model matrix ${date}`,
    '',
    `${rows.filter((r) => r.pass).length} of ${rows.length} runs pass.`,
    '',
    '| Model | Surface | Provider | Task | Result | Turns | Seconds |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.model} | ${r.surface} | ${r.provider} | ${r.task} | ${r.pass ? 'pass' : `fail: ${r.problems.join('; ')}`} | ${r.turns ?? '-'} | ${Math.round(r.wallMs / 1000)} |`,
    ),
    '',
  ].join('\n')
