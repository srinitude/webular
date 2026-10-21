// Diversity quotas (benchmark-spec.md, "Diversity quotas"; guard test 3).
// Returns every broken quota; an empty list means the set passes. A quota whose
// families have no tasks in the set does not apply.
import type { Task } from './schema.ts'

const group = (t: Task) => t.family.split('.')[0] ?? ''
const pct = (x: number) => `${Math.round(x * 100)}%`

const domainBreaks = (tasks: readonly Task[]): string[] => {
  const counts = new Map<string, number>()
  for (const t of tasks) counts.set(t.tags.domain, (counts.get(t.tags.domain) ?? 0) + 1)
  const few = counts.size < 8 ? [`only ${counts.size} domains, need at least 8`] : []
  const over = [...counts]
    .filter(([, n]) => n / tasks.length > 0.2)
    .map(([d, n]) => `domain ${d} is ${pct(n / tasks.length)}, over 20%`)
  return [...few, ...over]
}

interface Quota {
  readonly name: string
  readonly groups: readonly string[]
  readonly hit: (t: Task) => boolean
  readonly min?: number
  readonly max?: number
}

const QUOTAS: readonly Quota[] = [
  {
    name: 'non-English',
    groups: ['search', 'answer', 'research'],
    hit: (t) => t.tags.language !== 'en',
    min: 0.2,
  },
  { name: 'fresh', groups: ['answer', 'research'], hit: (t) => t.tags.fresh, min: 0.2 },
  { name: 'long-tail', groups: [], hit: (t) => t.tags.longTail, min: 0.25 },
  { name: 'navigational', groups: ['search'], hit: (t) => t.tags.navigational, max: 0.1 },
  {
    name: 'false or no premise',
    groups: ['answer'],
    hit: (t) => t.tags.premise !== 'true',
    min: 0.2,
  },
]

const quotaBreak = (tasks: readonly Task[], q: Quota): string[] => {
  const pool = q.groups.length === 0 ? tasks : tasks.filter((t) => q.groups.includes(group(t)))
  if (pool.length === 0) return []
  const s = pool.filter(q.hit).length / pool.length
  const scope = q.groups.length === 0 ? 'all' : q.groups.join('/')
  if (q.min !== undefined && s < q.min)
    return [`${q.name} is ${pct(s)} of ${scope}, min ${pct(q.min)}`]
  if (q.max !== undefined && s > q.max)
    return [`${q.name} is ${pct(s)} of ${scope}, max ${pct(q.max)}`]
  return []
}

export const quotaBreaks = (tasks: readonly Task[]): string[] =>
  tasks.length === 0
    ? ['no tasks']
    : [...domainBreaks(tasks), ...QUOTAS.flatMap((q) => quotaBreak(tasks, q))]
