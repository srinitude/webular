// Pure shapes the views draw: a site tree from a URL list, side by side rows
// from a unified diff, citation markers split out of an answer, and the plain
// fetch outcome for a failed source.

// The {url, reason} partial-failure shape every discovery command returns.
export interface FetchError {
  readonly url: string
  readonly reason?: string
}

// ponytail: matches the error text errMsg() produces; a typed fetch outcome would beat the regexes.
export const outcomeLabel = (reason = '') =>
  /redirects?\b.*(many|limit|exceed)/i.test(reason)
    ? 'Too many redirects'
    : /redirect/i.test(reason)
      ? 'Blocked redirect'
      : /time(d)? ?out/i.test(reason)
        ? 'Timed out'
        : /\bHTTP\b|\bstatus\b|\b[45]\d\d\b/.test(reason)
          ? 'HTTP error'
          : 'Network error'

export interface TreeNode {
  readonly name: string
  count: number
  failed: number
  url?: string
  outcome?: string
  readonly children: Map<string, TreeNode>
}

const node = (name: string): TreeNode => ({ name, count: 0, failed: 0, children: new Map() })

// Folds each URL into host, then path segments, once each; failed URLs stay in the tree.
export const buildTree = (urls: ReadonlyArray<string>, errors: ReadonlyArray<FetchError> = []) => {
  const root = node('')
  const seen = new Set<string>()
  const add = (url: string, outcome?: string) => {
    if (seen.has(url)) return
    seen.add(url)
    const u = URL.parse(url)
    const parts = u ? [u.host, ...u.pathname.split('/').filter(Boolean)] : [url]
    const bump = (n: TreeNode) => {
      n.count++
      if (outcome) n.failed++
    }
    bump(root)
    let at = root
    for (const part of parts) {
      const next = at.children.get(part) ?? node(part)
      at.children.set(part, next)
      bump(next)
      at = next
    }
    at.url = url
    at.outcome = outcome
  }
  for (const e of errors) add(e.url, outcomeLabel(e.reason))
  for (const url of urls) add(url)
  return root
}

export interface DiffRow {
  readonly left: string | undefined
  readonly right: string | undefined
}

// Pairs each run of removed lines with the added lines that follow it.
export const splitDiff = (diff: string): DiffRow[] => {
  const rows: DiffRow[] = []
  let dels: string[] = []
  let adds: string[] = []
  const flush = () => {
    for (let i = 0; i < Math.max(dels.length, adds.length); i++)
      rows.push({ left: dels[i], right: adds[i] })
    dels = []
    adds = []
  }
  for (const line of diff.replace(/\n$/, '').split('\n')) {
    if (/^(---|\+\+\+|@@)/.test(line)) flush()
    else if (line.startsWith('-')) dels.push(line.slice(1))
    else if (line.startsWith('+')) adds.push(line.slice(1))
    else {
      flush()
      rows.push({ left: line.slice(1), right: line.slice(1) })
    }
  }
  flush()
  return rows
}

export type Citation =
  | string
  | { readonly n: number; readonly failed: boolean; readonly missing: boolean }

// "[2]" means sources[1]; a marker whose source failed or is missing says so.
export const citations = (
  text: string,
  sources: ReadonlyArray<{ readonly title?: string; readonly url: string }>,
  errors: ReadonlyArray<FetchError> = [],
): Citation[] => {
  const failed = new Set(errors.map((e) => e.url))
  const cite = (n: number) => ({
    n,
    failed: failed.has(sources[n - 1]?.url ?? ''),
    missing: n < 1 || n > sources.length,
  })
  return text
    .split(/\[(\d+)\]/)
    .map((part, i) => (i % 2 === 0 ? part : cite(Number(part))))
    .filter((part) => part !== '')
}
