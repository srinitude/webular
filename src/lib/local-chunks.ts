// Heading-tree chunks for the local index (2610.18622, 2604.04948): page text
// splits at Markdown-style heading lines. Page-level BM25 still picks the
// pages; only the returned hits are split, from the body the search query
// already read, so the index stores no chunk copies and no extra query runs.
import { words } from './simhash.ts'

interface Chunk {
  readonly path: string
  readonly body: string
}

const HEADING = /^(#{1,6})\s+(.+)$/
const SNIPPET_CHARS = 240

const flush = (chunks: Chunk[], trail: string[], lines: string[]) => {
  const body = lines.join('\n').trim()
  if (body) chunks.push({ path: trail.filter(Boolean).join(' > '), body })
  lines.length = 0
}

/** Splits text at heading lines; the heading path is the trail of open headings. */
const chunkByHeadings = (text: string): Chunk[] => {
  const chunks: Chunk[] = []
  const trail: string[] = []
  const lines: string[] = []
  for (const line of text.split('\n')) {
    const heading = HEADING.exec(line.trim())
    if (!heading) {
      lines.push(line)
      continue
    }
    flush(chunks, trail, lines)
    const depth = (heading[1] as string).length
    trail.length = depth
    trail[depth - 1] = (heading[2] as string).trim()
  }
  flush(chunks, trail, lines)
  return mergeSmall(chunks)
}

// A chunk under MIN_WORDS words joins the chunk after it (2603.24556), so a stub
// section ("See the plans.") never stands alone as a snippet; the last one stays.
const MIN_WORDS = 8
const mergeSmall = (chunks: ReadonlyArray<Chunk>): Chunk[] => {
  const out: Chunk[] = []
  let carry = ''
  for (const [i, c] of chunks.entries()) {
    const body = carry ? `${carry}\n${c.body}` : c.body
    carry = i < chunks.length - 1 && words(body).length < MIN_WORDS ? body : ''
    if (!carry) out.push({ path: c.path, body })
  }
  return out
}

const shared = (terms: ReadonlyArray<string>, text: string) => {
  const lower = text.toLowerCase()
  return terms.filter((t) => lower.includes(t)).length
}

/** Distinct query words, computed once per search. */
export const queryTerms = (query: string) => [...new Set(words(query))]

// ponytail: distinct query words found as substrings (heading path x2), no stemming,
// and the snippet is the chunk's opening; use per-chunk BM25 if ranking misses.
/** The page's chunk sharing the most query words; undefined when none shares one. */
export const bestChunk = (text: string, terms: ReadonlyArray<string>) => {
  const best = chunkByHeadings(text).reduce<{ c?: Chunk; s: number }>(
    (top, c) => {
      const s = 2 * shared(terms, c.path) + shared(terms, c.body)
      return s > top.s ? { c, s } : top
    },
    { s: 0 },
  )
  return best.c
    ? { section: best.c.path, description: best.c.body.slice(0, SNIPPET_CHARS) }
    : undefined
}
