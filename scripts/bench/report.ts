// report.md (eleven parts, in spec order) and report.json (every row), built
// by pure functions and written to the given output folder.
import { Effect, FileSystem, Path } from 'effect'
import { rowBytes, rowHosts, rowUsd } from './cost.ts'
import {
  answerSplit,
  cost,
  type FamilyResult,
  header,
  latency,
  type ReportInput,
  results,
  section,
  table,
} from './report-parts.ts'
import type { Row } from './schema.ts'

const pts = (x: number) => (x * 100).toFixed(1)

export const slices = (s: ReportInput['slices']) =>
  section(
    6,
    'Slices',
    table(
      ['axis', 'value', 'tool', 'n', 'score'],
      s.map((r) => [r.axis, r.value, r.tool, String(r.n), pts(r.score)]),
    ),
  )

// A gap over 10 points between public and private scores is flagged.
export const publicPrivate = (p: ReportInput['publicPrivate']) =>
  section(
    7,
    'Public against private',
    table(
      ['family', 'tool', 'public', 'private', 'gap'],
      p.map((r) => {
        const gap = Math.abs(r.pub - r.priv) * 100
        const flag = gap > 10 ? ' FLAGGED' : ''
        return [r.family, r.tool, pts(r.pub), pts(r.priv), `${gap.toFixed(1)}${flag}`]
      }),
    ),
  )

const SCORED = new Set(['ok', 'wrong', 'not_offered'])

export const errors = (rows: readonly Row[]) => {
  const bad = rows.filter((r) => !SCORED.has(r.status))
  const kinds = [...new Set(bad.map((r) => `${r.key.provider} | ${r.status}`))].sort()
  const body = kinds.map((k) => {
    const g = bad.filter((r) => `${r.key.provider} | ${r.status}` === k)
    const samples = g.slice(0, 3).map((r) => `${r.key.taskId} run ${r.key.run}`)
    return [...k.split(' | '), String(g.length), samples.join('; ')]
  })
  return section(8, 'Errors', table(['tool', 'kind', 'count', 'sample rows'], body))
}

// Not-offered jobs and webular-only fixtures, kept out of the headline.
export const capability = (rs: readonly FamilyResult[]) =>
  section(
    9,
    'Capability section',
    table(
      ['family', 'tool', 'kind', 'score'],
      rs
        .filter((r) => r.webularOnly || r.score === null)
        .map((r) => [
          r.family,
          r.tool,
          r.webularOnly ? 'webular-only fixture' : 'not offered',
          r.score === null ? 'not offered' : pts(r.score),
        ]),
    ),
  )

export const claims = (c: ReportInput['claims']) =>
  section(
    10,
    'Vendor claims',
    table(
      ['tool', 'metric', 'vendor number', 'harness number', 'source', 'date'],
      c.map((r) => [r.tool, r.metric, r.claimed, r.measured, r.url, r.date]),
    ),
  )

export const changes = (c: ReportInput['changes']) =>
  section(11, 'Changes', c.map((r) => `- ${r.text} (${r.commit})`).join('\n') || 'None.')

export const reportMarkdown = (input: ReportInput) =>
  [
    `# Webular benchmark report: round ${input.header.roundId}\n`,
    header(input.header),
    results(input.results),
    answerSplit(input.answerSplit),
    latency(input.rows),
    cost(input.rows, input.correct),
    slices(input.slices),
    publicPrivate(input.publicPrivate),
    errors(input.rows),
    capability(input.results),
    claims(input.claims),
    changes(input.changes),
  ].join('\n')

const reportJson = (input: ReportInput) =>
  `${JSON.stringify(
    {
      header: input.header,
      rows: input.rows.map((r) => ({
        ...r,
        usd: rowUsd(r),
        bytes: rowBytes(r),
        hosts: rowHosts(r),
      })),
    },
    null,
    2,
  )}\n`

// Writes report.md and report.json into outDir, creating it when missing.
export const writeReport = (outDir: string, input: ReportInput) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    yield* fs.makeDirectory(outDir, { recursive: true })
    yield* fs.writeFileString(path.join(outDir, 'report.md'), reportMarkdown(input))
    yield* fs.writeFileString(path.join(outDir, 'report.json'), reportJson(input))
  })
