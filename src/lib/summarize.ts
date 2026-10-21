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

function pushTrimmed(out: string[], piece: string): void {
  const trimmed = piece.trim()
  if (trimmed.length > 0) out.push(trimmed)
}

// A sentence ends at [.!?] plus whitespace before an uppercase letter or a
// quote. One forward scan, O(B): the lookbehind split it replaces went
// superlinear on big pages (100,000 sentences took about 6 s).
const BOUNDARY = /[.!?]\s+(?=[A-Z"'])/g

function splitSentences(text: string): string[] {
  const out: string[] = []
  let last = 0
  for (const m of text.matchAll(BOUNDARY)) {
    pushTrimmed(out, text.slice(last, m.index + 1))
    last = m.index + m[0].length
  }
  pushTrimmed(out, text.slice(last))
  return out
}

function buildFreqMap(lists: string[][]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const words of lists) for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  return freq
}

function scoreTokens(words: string[], freq: Map<string, number>, maxFreq: number): number {
  if (words.length === 0 || maxFreq === 0) return 0
  const total = words.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0)
  return total / (words.length * maxFreq)
}

interface SummarizeResult {
  sentences: string[]
  summary: string
}

// Loop, not Math.max(...spread): spreading a large vocabulary as arguments
// overflows the engine's argument limit on big pages.
function maxFrequency(freq: Map<string, number>): number {
  let max = 0
  for (const count of freq.values()) if (count > max) max = count
  return max
}

export function summarizeText(text: string, topN: number): SummarizeResult {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return { sentences: [], summary: '' }

  // Tokenize each sentence once and reuse it for counting and scoring.
  // Sentence cuts fall on whitespace, so the joined sentence tokens equal
  // the whole text's tokens.
  const tokens = sentences.map(tokenize)
  const freq = buildFreqMap(tokens)
  const maxFreq = maxFrequency(freq)

  const scored = sentences.map((s, i) => ({
    s,
    i,
    score: scoreTokens(tokens[i] ?? [], freq, maxFreq),
  }))
  scored.sort((a, b) => b.score - a.score)

  const top = scored.slice(0, topN).sort((a, b) => a.i - b.i)
  const picked = top.map((x) => x.s)

  return { sentences: picked, summary: picked.join(' ') }
}
