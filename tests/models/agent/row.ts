// One result row in the guards' TrackRow shape (tests/models/guards.ts): who
// ran, on which arm, under which conditions, what it called, what it cost,
// and whether it passed, plus the problems and the arm-order seed.
import type { Job } from '../jobs.ts'
import type { parseStream } from '../report.ts'
import { missOf } from '../check.ts'
import { costUsd } from './rates.ts'

const sha = (s: string) => new Bun.CryptoHasher('sha256').update(s).digest('hex').slice(0, 16)

export const rowOf = (
  job: Job,
  problems: readonly string[],
  run: ReturnType<typeof parseStream>,
  wallMs: number,
) => ({
  model: job.model,
  surface: job.surface,
  provider: job.provider,
  task: job.s.id,
  run: job.attempt,
  family: job.s.tool,
  promptSha: sha(job.s.prompt),
  maxTurns: job.s.maxTurns ?? job.file.defaults.maxTurns,
  timeoutSec: job.s.timeoutSec ?? job.file.defaults.timeoutSec,
  grader: job.s.eval.kind,
  seed: job.seed,
  pass: problems.length === 0,
  problems,
  miss: missOf(problems),
  skipped: problems.some((p) => p.startsWith('skipped:')),
  toolCalls: run.uses.map((u) => ({ name: u.name, input: u.input })),
  turns: run.result?.num_turns ?? null,
  ...run.usage,
  wallMs,
  costUsd: costUsd(job.model, run.usage),
  raw: job.rawPath,
})
