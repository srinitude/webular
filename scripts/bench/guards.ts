// Pure run guards (spec-integrity-and-report.md guard tests 8, 9, 11, 12, 16).
// Each returns the list of problems; an empty list means the rule holds.
import { leaksFixtureUrl } from '../../bench/fixtures/server.ts'
import type { Row, RunConfig } from './schema.ts'

// Loopback, private, and link-local hosts never belong in a tool's output.
const PRIVATE_URL =
  /\bhttps?:\/\/(?:localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)(?=[:/?#\s"']|$)/gi

export const privateUrls = (text: string): string[] => text.match(PRIVATE_URL) ?? []

// A row whose output holds a private URL, or a fixture path from the task set
// (bench/fixtures/server.ts), fails guard 8.
export const rowsWithPrivateUrls = (rows: ReadonlyArray<Row>) =>
  rows.flatMap((r) => {
    const urls = privateUrls(r.output)
    const hits = urls.length > 0 ? urls : leaksFixtureUrl(r.output) ? ['fixture path'] : []
    return hits.map((u) => `${r.key.provider}/${r.key.taskId}: ${u}`)
  })

// A cold row ran a cache-busting variant of its query and saw no cache hit.
export const BUST_PARAM = 'bust='

export const coldProblems = (rows: ReadonlyArray<Row>) =>
  rows
    .filter((r) => r.phase === 'cold')
    .flatMap((r) => [
      ...(r.cached ? [`${r.key.provider}/${r.key.taskId}: cold row had a cache hit`] : []),
      ...(r.query.includes(BUST_PARAM)
        ? []
        : [`${r.key.provider}/${r.key.taskId}: cold row has no bust variant`]),
    ])

export type Limits = Pick<RunConfig, 'resultCount' | 'timeoutMs' | 'retries' | 'budgetUsd'>

export const unequalLimits = (byProvider: Readonly<Record<string, Limits>>) => {
  const entries = Object.entries(byProvider)
  const ref = JSON.stringify(entries[0]?.[1])
  return entries.filter(([, l]) => JSON.stringify(l) !== ref).map(([p]) => `${p}: limits differ`)
}

// Every provider and task ran at default and best settings, each with its body.
export const settingsProblems = (rows: ReadonlyArray<Row>) => {
  const missingBody = rows
    .filter((r) => r.requestBody.trim() === '')
    .map((r) => `${r.key.provider}/${r.key.taskId}/${r.settings}: request body missing`)
  const ran = new Set(rows.map((r) => `${r.key.provider}|${r.key.taskId}|${r.settings}`))
  const pairs = new Set(rows.map((r) => `${r.key.provider}|${r.key.taskId}`))
  const missing = [...pairs].flatMap((p) =>
    (['default', 'best'] as const)
      .filter((s) => !ran.has(`${p}|${s}`))
      .map((s) => `${p}: ${s} settings missing`),
  )
  return [...missingBody, ...missing]
}

// robots.txt rules for user-agent * (and webular): longest match wins, Allow
// wins ties. ponytail: no wildcard or $ patterns, add when a site uses them.
const rulesFor = (robots: string) => {
  const rules: { allow: boolean; path: string }[] = []
  let applies = false
  for (const raw of robots.split('\n')) {
    const [field = '', ...rest] = raw.replace(/#.*/, '').split(':')
    const key = field.trim().toLowerCase()
    const value = rest.join(':').trim()
    if (key === 'user-agent') applies = value === '*' || value.toLowerCase() === 'webular'
    else if (applies && (key === 'allow' || key === 'disallow') && value !== '')
      rules.push({ allow: key === 'allow', path: value })
  }
  return rules
}

const allowed = (rules: ReturnType<typeof rulesFor>, path: string) => {
  const hits = rules.filter((r) => path.startsWith(r.path))
  const best = hits.toSorted(
    (a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow),
  )[0]
  return best?.allow ?? true
}

export const robotsDisallowed = (robots: string, urls: ReadonlyArray<string>): string[] => {
  const rules = rulesFor(robots)
  return urls.filter((u) => {
    const url = new URL(u)
    return !allowed(rules, url.pathname + url.search)
  })
}
