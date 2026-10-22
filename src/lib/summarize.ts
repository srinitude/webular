// FOSS extractive summarizer: score sentences by normalized word frequency,
// ignore stopwords, return top-N in original order. No external dependencies.

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'it',
  'its',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'can',
  'that',
  'this',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'as',
  'if',
  'not',
  'so',
  'than',
  'then',
  'when',
  'where',
  'which',
  'who',
])

// match() yields the same maximal [a-z0-9] runs as replace-then-split, with
// one fewer full-size copy and no empty tokens to filter.
function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (w) => w.length > 1 && !STOPWORDS.has(w),
  )
}

// Sentences are kept as [start, end) offsets into the text, not as strings:
// holding one string per sentence plus its token strings makes every GC walk
// a heap that grows with the page, so total time goes superlinear.
export interface Spans {
  starts: number[]
  ends: number[]
}

function pushTrimmed(spans: Spans, text: string, from: number, to: number): void {
  const piece = text.slice(from, to)
  const trimmed = piece.trim()
  if (trimmed.length === 0) return
  const start = from + piece.length - piece.trimStart().length
  spans.starts.push(start)
  spans.ends.push(start + trimmed.length)
}

// UAX #29 sentence breaks, skipping one after an abbreviation ("Dr. Smith").
// ponytail: fixed English abbreviation list; a per-locale list if pages need it.
const SEGMENTER = new Intl.Segmenter('en', { granularity: 'sentence' })
const ABBR = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|U\.S|No|Inc|Ltd|Co|Fig)\.\s*$/
export function splitSentences(text: string): Spans {
  const spans: Spans = { starts: [], ends: [] }
  let last = 0
  for (const { index, segment } of SEGMENTER.segment(text)) {
    const end = index + segment.length
    if (end < text.length && ABBR.test(segment.slice(-12))) continue
    pushTrimmed(spans, text, last, end)
    last = end
  }
  return spans
}

// Research answer sentences keep the original splitter: a sentence ends at [.!?] plus
// whitespace before an uppercase letter or a quote. One forward scan, O(B), no lookbehind.
// The research.sentences eval labels are indexes into these sentences.
const RESEARCH_BOUNDARY = /[.!?]\s+(?=[A-Z"'])/g
export function splitResearchSentences(text: string): Spans {
  const spans: Spans = { starts: [], ends: [] }
  let last = 0
  for (const m of text.matchAll(RESEARCH_BOUNDARY)) {
    pushTrimmed(spans, text, last, m.index + 1)
    last = m.index + m[0].length
  }
  pushTrimmed(spans, text, last, text.length)
  return spans
}

// Each sentence is tokenized once; tokens become small-integer word ids in
// one flat array, so the only strings that outlive a sentence are the
// distinct words. Sentence cuts fall on whitespace, so the joined sentence
// tokens equal the whole text's tokens.
export interface TokenIds {
  ids: number[]
  offsets: number[]
  freq: number[]
}

export function tokenIds(text: string, spans: Spans): TokenIds {
  const vocab = new Map<string, number>()
  const out: TokenIds = { ids: [], offsets: [0], freq: [] }
  for (let i = 0; i < spans.starts.length; i++) {
    for (const w of tokenize(text.slice(spans.starts[i], spans.ends[i]))) {
      let id = vocab.get(w)
      if (id === undefined) {
        id = out.freq.length
        vocab.set(w, id)
        out.freq.push(0)
      }
      out.freq[id] = (out.freq[id] ?? 0) + 1
      out.ids.push(id)
    }
    out.offsets.push(out.ids.length)
  }
  return out
}

// Loop, not Math.max(...spread): spreading a large vocabulary as arguments
// overflows the engine's argument limit on big pages.
function maxFrequency(freq: number[]): number {
  let max = 0
  for (const count of freq) if (count > max) max = count
  return max
}

export function scores(t: TokenIds): Float64Array {
  const maxFreq = maxFrequency(t.freq)
  const out = new Float64Array(t.offsets.length - 1)
  for (let i = 0; i < out.length; i++) {
    const from = t.offsets[i] ?? 0
    const len = (t.offsets[i + 1] ?? 0) - from
    if (len === 0 || maxFreq === 0) continue
    let total = 0
    for (let k = from; k < from + len; k++) total += t.freq[t.ids[k] ?? 0] ?? 0
    out[i] = total / (len * maxFreq)
  }
  return out
}

interface SummarizeResult {
  sentences: string[]
  summary: string
}

// Question focus: key terms are the question's words minus question words.
// Each sentence scores the inverse sentence frequency of the key terms it
// holds, so a rare term ("born") beats one the page repeats ("uncertainty"),
// times 1.5 when it names the entity. Frequency only breaks ties.
// ponytail: lexical picker; a Jev Score over candidates could replace it.
const QUESTION_WORDS = new Set(['what', 'how', 'why', 'whose', 'whom'])
interface Focus {
  query: string
  entity?: string | undefined
}
function focusScores(text: string, spans: Spans, focus: Focus): number[] {
  const keys = new Set(tokenize(focus.query).filter((w) => !QUESTION_WORDS.has(w)))
  const entity = new Set(tokenize(focus.entity ?? '').filter((w) => !keys.has(w)))
  const sets = spans.starts.map((from, i) => new Set(tokenize(text.slice(from, spans.ends[i]))))
  const df = new Map<string, number>()
  for (const set of sets) for (const k of keys) if (set.has(k)) df.set(k, (df.get(k) ?? 0) + 1)
  return sets.map((set) => {
    let score = 0
    for (const [k, n] of df) if (set.has(k)) score += Math.log((sets.length + 1) / n)
    for (const e of entity) if (set.has(e)) return score * 1.5
    return score
  })
}
export function summarizeText(
  text: string,
  topN: number,
  focus?: Focus,
  split: (text: string) => Spans = splitSentences,
): SummarizeResult {
  const spans = split(text)
  if (spans.starts.length === 0) return { sentences: [], summary: '' }
  const score = scores(tokenIds(text, spans))
  const key = focus ? focusScores(text, spans, focus) : undefined
  // A stable sort of indices keeps tied sentences in document order.
  const order = Array.from(score, (_, i) => i).sort(
    (a, b) => (key?.[b] ?? 0) - (key?.[a] ?? 0) || (score[b] ?? 0) - (score[a] ?? 0),
  )
  const picked = order
    .slice(0, topN)
    .sort((a, b) => a - b)
    .map((i) => text.slice(spans.starts[i], spans.ends[i]))
  return { sentences: picked, summary: picked.join(' ') }
}
