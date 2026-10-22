// Pure helpers for the research report: drop repeated sentences, flag number
// conflicts between sources, and say which sources gave no answer.
// Sources: arXiv 2510.07861 (dedupe), 2512.01948 and 2607.17291 (conflicts),
// 2602.07549 (coverage ledger), 2610.15459 (gaps section).

export type Conflict = { sourceA: number; sourceB: number; sentenceA: string; sentenceB: string }
export type LedgerRow = {
  url: string
  status: 'answered' | 'failed' | 'no-evidence'
  reason?: string | undefined
}

const MAX_CONFLICTS = 5

const words = (s: string): Set<string> =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean),
  )

const jaccard = (a: Set<string>, b: Set<string>): number => {
  const both = [...a].filter((w) => b.has(w)).length
  const all = a.size + b.size - both
  return all === 0 ? 1 : both / all
}

const numbers = (s: string): Set<string> => new Set(s.match(/\d+(?:\.\d+)?/g) ?? [])

const sameSet = (a: Set<string>, b: Set<string>): boolean =>
  a.size === b.size && [...a].every((x) => b.has(x))

export const dedupeSentences = (perSource: string[][]): string[][] => {
  const seen: Set<string>[] = []
  const fresh = (s: string): boolean => {
    const w = words(s)
    if (seen.some((k) => jaccard(k, w) >= 0.8)) return false
    seen.push(w)
    return true
  }
  return perSource.map((sentences) => sentences.filter(fresh))
}

const disagree = (x: string, y: string): boolean => {
  const nx = numbers(x)
  const ny = numbers(y)
  return nx.size > 0 && ny.size > 0 && !sameSet(nx, ny) && jaccard(words(x), words(y)) >= 0.5
}

export const findConflicts = (perSource: string[][]): Conflict[] =>
  perSource
    .flatMap((as, sourceA) =>
      perSource
        .slice(sourceA + 1)
        .flatMap((bs, i) =>
          as.flatMap((sentenceA) =>
            bs
              .filter((sentenceB) => disagree(sentenceA, sentenceB))
              .map((sentenceB) => ({ sourceA, sourceB: sourceA + 1 + i, sentenceA, sentenceB })),
          ),
        ),
    )
    .slice(0, MAX_CONFLICTS)

export const coverageLedger = (
  found: ReadonlyArray<{ url: string }>,
  kept: ReadonlyArray<{ url: string }>,
  errors: ReadonlyArray<{ url: string; reason: string }>,
): LedgerRow[] => {
  const answered = new Set(kept.map((k) => k.url))
  const failed = new Map(errors.map((e) => [e.url, e.reason]))
  return found.map(({ url }): LedgerRow => {
    if (answered.has(url)) return { url, status: 'answered' }
    const reason = failed.get(url)
    return reason === undefined ? { url, status: 'no-evidence' } : { url, status: 'failed', reason }
  })
}

export const gapsSection = (ledger: ReadonlyArray<LedgerRow>, conflicts: Conflict[]): string => {
  const gaps = ledger.filter((r) => r.status !== 'answered')
  if (gaps.length === 0 && conflicts.length === 0) return ''
  return [
    '## Gaps',
    ...gaps.map(
      (g) => `- ${g.url}: ${g.status === 'failed' ? `failed (${g.reason})` : 'no evidence'}`,
    ),
    ...conflicts.map(
      (c) => `- [${c.sourceA + 1}] vs [${c.sourceB + 1}]: "${c.sentenceA}" / "${c.sentenceB}"`,
    ),
  ].join('\n')
}
