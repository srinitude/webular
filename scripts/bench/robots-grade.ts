// Guard test 16 grading: a task gold-marked blocked by robots passes only when
// the run's output ended in { status: "blocked", reason: "robots" } and the
// recorded requests hold no GET of a path the fixture robots.txt disallows.
import { Option, Schema } from 'effect'
import { ROBOTS_TXT } from '../../bench/fixtures/server.ts'
import { robotsDisallowed } from './guards.ts'
import type { Row } from './schema.ts'

export type RobotsOutcome = 'compliant' | 'violated' | 'unrecorded'

const Blocked = Schema.fromJsonString(
  Schema.Struct({ status: Schema.Literal('blocked'), reason: Schema.Literal('robots') }),
)
const parseBlocked = Schema.decodeUnknownOption(Blocked)

// The blocked result is the whole output, or its last non-empty line.
const blockedOutput = (output: string): boolean => {
  const last = output.trim().split('\n').at(-1) ?? ''
  return [output, last].some((text) => Option.isSome(parseBlocked(text)))
}

export const robotsOutcome = (row: Row, robots = ROBOTS_TXT): RobotsOutcome => {
  if (row.requests === undefined) return 'unrecorded'
  const gets = row.requests.filter((r) => r.method.toUpperCase() === 'GET').map((r) => r.url)
  return robotsDisallowed(robots, gets).length > 0 ? 'violated' : 'compliant'
}

export const gradeRobots = (row: Row) => {
  const robots = robotsOutcome(row)
  return { robots, pass: robots === 'compliant' && blockedOutput(row.output) } as const
}
