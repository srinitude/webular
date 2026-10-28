// --why: bare, it says what webular is and how it picks results, offline; on a
// command, it adds a `why` record built only from the payload the run already
// holds (no network call, nothing written to disk).
import { Effect } from 'effect'
import pkg from '../../package.json' with { type: 'json' }
import { stableJson } from '../core/output.ts'

const TRY = 'webular search "your query" --why'

// Each step: a stable id and its human lines (40 columns or less).
const STEPS = [
  ['sources', ['Asks several search sources at', 'once.']],
  ['fusion', ['Merges their lists by weighted', 'rank fusion.']],
  ['local-index', ['Adds pages you already read.']],
  ['domain-signal', ['Moves official sites up and', 'aggregators down.']],
  ['lexical-rerank', ['Re-ranks web hits by word match.']],
  ['jev', ['Lets Jev settle close calls when', 'a Jev key is set.']],
] as const

export const WHY_TEXT = [
  'webular searches, reads, and answers',
  'from the web, on your own machine.',
  'No key needed. Jev is optional.',
  '',
  'How it picks results:',
  ...STEPS.flatMap(([, lines], i) => lines.map((l, j) => (j ? `     ${l}` : `  ${i + 1}. ${l}`))),
  '',
  'See it for a real run:',
  `  ${TRY}`,
]

const steps = STEPS.map(([id, lines]) => ({ id, text: lines.join(' ') }))

export function printWhy(form: 'human' | 'json' | 'ndjson'): Effect.Effect<void> {
  return Effect.sync(() => {
    const text =
      form === 'json'
        ? stableJson({ kind: 'why', tool: 'webular', version: pkg.version, steps, try: TRY })
        : form === 'ndjson'
          ? [...steps, { try: TRY }].map((s) => stableJson(s)).join('\n')
          : WHY_TEXT.join('\n')
    process.stdout.write(`${text}\n`)
  })
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const host = (url: unknown): string =>
  URL.canParse(String(url)) ? new URL(String(url)).host : String(url)

// Each result's raw fused score, terms, and word come from meta.scores
// (search-score-word.ts), matched by url; a free-source fallback has none.
const searchWhy = (data: Record<string, unknown>) => {
  const meta = isRec(data['meta']) ? data['meta'] : {}
  const results = Array.isArray(data['results']) ? data['results'].filter(isRec) : []
  const scores = Array.isArray(meta['scores']) ? meta['scores'].filter(isRec) : []
  const scoreOf = (url: unknown) => {
    const s = scores.find((x) => x['url'] === url)
    return s ? { score: s['score'], parts: s['parts'], word: s['word'] } : {}
  }
  return {
    command: 'search',
    fusion: 'weighted-rrf',
    k: 60,
    query: data['query'],
    results: results.map((r, i) => ({ url: r['url'], rank: i + 1, ...scoreOf(r['url']) })),
    sources: isRec(meta['sources']) ? meta['sources'] : {},
    weak: meta['weak'] === true,
  }
}

export const SCORE_LABEL = 'Scores compare results in this run only.'
// WEAK_SCORE (1.5/61) in src/lib/search.ts, printed to 4 places; a test keeps them equal.
export const WEAK_AT = '0.0246'

const scoreText = (r: Record<string, unknown>) =>
  typeof r['score'] === 'number' && Array.isArray(r['parts'])
    ? ` ${[r['score'].toFixed(4), ...r['parts'], `(${String(r['word'])})`].join(' ')}`
    : ''

// The card ends on the weak flag the record holds and one command to try next:
// a broader research run when weak, else a read of the top page.
const verdict = (why: Record<string, unknown>, top: unknown) =>
  why['weak'] === true || typeof top !== 'string'
    ? [
        `Verdict: weak. The top fused hit scored under ${WEAK_AT}.`,
        `Next: webular research ${JSON.stringify(String(why['query'] ?? 'your query'))}`,
      ]
    : [
        `Verdict: not weak. The top fused hit scored ${WEAK_AT} or more.`,
        `Next: webular scrape ${top}`,
      ]

// The `why` record per command, from the payload alone.
export function whyRecord(name: string, data: unknown): Record<string, unknown> {
  const rec = isRec(data) ? data : {}
  if (name === 'search') return searchWhy(rec)
  if (name === 'answer')
    return { command: name, sources: rec['sources'] ?? [], attribution: 'document' }
  if (name === 'research') return { command: name, coverage: rec['coverage'] ?? [] }
  return { command: name, choices: [] }
}

export const withWhy = (name: string, result: unknown): unknown =>
  isRec(result) ? { ...result, why: whyRecord(name, result) } : result

// Human output: the block after the command's own text.
export function whyBlock(data: unknown): string {
  const why = isRec(data) && isRec(data['why']) ? data['why'] : {}
  if (Array.isArray(why['choices'])) return '\nThis command made no ranking choices.'
  const results = Array.isArray(why['results']) ? why['results'].filter(isRec) : []
  const sources = isRec(why['sources']) ? Object.entries(why['sources']) : []
  return [
    '',
    'Why these results:',
    ...(why['command'] === 'search' ? [SCORE_LABEL] : []),
    ...results.map((r) => `${r['rank']}. ${host(r['url'])}${scoreText(r)}`),
    ...sources.map(([s, v]) => (isRec(v) ? `${s} ${v['status']} ${v['ms']}ms` : s)),
    ...(why['command'] === 'search' ? verdict(why, results[0]?.['url']) : []),
  ].join('\n')
}
