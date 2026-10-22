// The agent track's public-web task set: single-answer questions from one
// frozen bench/tasks answer-shaped set (BENCH_AGENT_SET, default the peer set
// dev/peers.jsonl), mapped onto the scenario shape. Peer arms cannot reach
// the local 127.0.0.1 fixture, so the agent track runs only these. With no
// task file, the inline sample stands in.
import { Config, Effect, FileSystem, Option, Schema } from 'effect'
import { ROOT } from '../../_support/root.ts'
import type { Scenario, ScenarioFile } from '../scenarios.ts'

const AnswerTask = Schema.Struct({
  id: Schema.String,
  input: Schema.Struct({ question: Schema.String }),
  gold: Schema.Struct({ answers: Schema.Array(Schema.String) }),
  aliases: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.Struct({ premise: Schema.String }),
})
type AnswerTask = typeof AnswerTask.Type

// The canary line and any row that is not an answer task decode to None.
const decodeLine = Schema.decodeUnknownOption(Schema.fromJsonString(AnswerTask))

const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A reply passes when it holds the gold or any alias, literally.
// ponytail: single-answer, no-premise questions only; multi-answer and
// false-premise families need the grader track's judge.
const toScenario = (t: AnswerTask): Scenario => ({
  id: t.id,
  intent: 'An agent answers a public-web question with its one web tool.',
  outcome: `The reply names ${t.gold.answers[0]}.`,
  eval: {
    kind: 'code',
    answerMatches: [...new Set([...t.gold.answers, ...(t.aliases ?? [])])].map(reEscape).join('|'),
  },
  tool: 'answer',
  anyTool: true,
  prompt: `${t.input.question} Reply in one line with the answer.`,
  reference: [],
})

export const publicTasks = (jsonl: string) =>
  jsonl
    .split('\n')
    .flatMap((line) => Option.toArray(decodeLine(line)))
    .filter((t) => t.tags.premise === 'none' && t.gold.answers.length === 1)
    .map(toScenario)

export const agentTasks = (file: ScenarioFile) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = yield* Config.String('BENCH_TASKS_DIR').pipe(
      Config.withDefault(`${ROOT}bench/tasks`),
    )
    const set = yield* Config.String('BENCH_AGENT_SET').pipe(Config.withDefault('dev/peers.jsonl'))
    const path = `${dir}/${set}`
    const sample = file.scenarios.filter((s) => (file.agentSample ?? []).includes(s.id))
    if (!(yield* fs.exists(path))) return sample
    const tasks = publicTasks(yield* fs.readFileString(path))
    return tasks.length ? tasks : sample
  })
