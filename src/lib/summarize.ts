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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function buildFreqMap(words: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  return freq
}

function scoreSentence(sentence: string, freq: Map<string, number>, maxFreq: number): number {
  const words = tokenize(sentence)
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

  const allWords = tokenize(text)
  const freq = buildFreqMap(allWords)
  const maxFreq = maxFrequency(freq)

  const scored = sentences.map((s, i) => ({ s, i, score: scoreSentence(s, freq, maxFreq) }))
  scored.sort((a, b) => b.score - a.score)

  const top = scored.slice(0, topN).sort((a, b) => a.i - b.i)
  const picked = top.map((x) => x.s)

  return { sentences: picked, summary: picked.join(' ') }
}
