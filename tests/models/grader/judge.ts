// One rubric judgment by one Claude model through headless `claude -p`, with
// no tools and no web, on a blinded answer.
import { Data, Duration, Effect } from 'effect'
import { spawnText } from '../baseline.ts'
import { blind } from './blind.ts'

export const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const
export type Model = (typeof MODELS)[number]
export type Verdict = 'pass' | 'fail'

class JudgeError extends Data.TaggedError('JudgeError')<{ reason: string; raw: string }> {}

const prompt = (rubric: string, task: string, answer: string) =>
  [
    'You are grading one answer against a rubric. Grade facts, not length or style.',
    `Rubric:\n${rubric}`,
    `Task:\n${task}`,
    `Answer:\n${blind(answer)}`,
    'Reply with exactly one word: PASS or FAIL.',
  ].join('\n\n')

export const judgeArgs = (model: Model, rubric: string, task: string, answer: string) => [
  '-p',
  prompt(rubric, task, answer),
  '--model',
  model,
  '--output-format',
  'text',
  '--max-turns',
  '1',
  '--tools',
  '',
  '--disallowedTools',
  'WebSearch,WebFetch',
  '--strict-mcp-config',
  '--setting-sources',
  'project',
  '--no-session-persistence',
]

export const parseVerdict = (raw: string): Verdict | undefined => {
  const words = raw.toUpperCase().match(/\b(PASS|FAIL)\b/g)
  const last = words?.at(-1)
  return last === undefined ? undefined : last === 'PASS' ? 'pass' : 'fail'
}

export const judge = (model: Model, rubric: string, task: string, answer: string) =>
  spawnText('claude', judgeArgs(model, rubric, task, answer), {
    CLAUDE_CODE_PLUGIN_DIRS: '',
    ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
  }).pipe(
    Effect.timeoutOrElse({
      duration: Duration.seconds(180),
      orElse: () => Effect.fail(new JudgeError({ reason: 'timed out', raw: '' })),
    }),
    Effect.flatMap(({ out, err, code }) => {
      const verdict = parseVerdict(out)
      return code === 0 && verdict
        ? Effect.succeed({ verdict, raw: out })
        : Effect.fail(new JudgeError({ reason: `exit ${code}, no verdict`, raw: `${out}${err}` }))
    }),
  )
