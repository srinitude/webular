// The text report for a peer round: status counts, per-pair tables, per-family
// paired tests with a shared-task headline, and webular's misses.
import { renderFamilies } from './family.ts'
import type { MetricDef, Provider, RunRecord } from './model.ts'
import { renderTable, sharedTasks, summarize } from './score.ts'

export type Row = RunRecord & { cached?: boolean }

// Status counts per provider, plus `cached`: repeats flagged as likely
// server-side cache hits (unusually fast). Flagged rows stay in the results.
export const statusLines = (providers: readonly Provider[], records: readonly Row[]) =>
  providers.map((p) => {
    const counts: Record<string, number> = {}
    for (const r of records) if (r.provider === p.id) counts[r.status] = (counts[r.status] ?? 0) + 1
    const cached = records.filter((r) => r.provider === p.id && r.cached).length
    return `  ${p.id}: ${JSON.stringify({ ...counts, cached })}${p.skip ? ` (${p.skip})` : ''}`
  })

const missLines = (records: readonly Row[]) =>
  records
    .filter((r) => r.provider === 'webular' && r.run === 1 && r.metrics['accuracy'] === 0)
    .map((r) => `  ${r.task}: ${r.status} ${(r.note ?? '').slice(0, 160)}`)

export const report = (
  providers: readonly Provider[],
  records: readonly Row[],
  defs: readonly MetricDef[],
  header: string,
) => {
  const [web] = providers.filter((p) => p.id === 'webular')
  if (!web) return 'no webular provider'
  const ran = (p: Provider) =>
    records.some((r) => r.provider === p.id && (r.status === 'ok' || r.status === 'error'))
  const parts = [header, 'status per provider:', ...statusLines(providers, records)]
  parts.push(renderTable('webular, every task', summarize(records, [web], defs), defs))
  const peers = providers.filter((x) => x.id !== 'webular' && ran(x))
  for (const p of peers) {
    const shared = sharedTasks(records, ['webular', p.id])
    const title = `webular vs ${p.id} on ${shared.size} shared tasks`
    parts.push(renderTable(title, summarize(records, [web, p], defs, shared), defs))
  }
  parts.push(
    renderFamilies(
      records,
      peers.map((p) => p.id),
    ),
  )
  parts.push('webular misses (run 1):', ...missLines(records))
  return parts.join('\n\n')
}
