// Sentence spans for the extractive summarizer: UAX #29 breaks for pages and
// the original research splitter, both as [start, end) offsets into the text.

// Sentences are kept as [start, end) offsets into the text, not as strings:
// holding one string per sentence plus its token strings makes every GC walk
// a heap that grows with the page, so total time goes superlinear.
export interface Spans {
  starts: number[]
  ends: number[]
}

function pushTrimmed(spans: Spans, text: string, from: number, to: number): void {
  const piece = text.slice(from, to)
  // String.trim keeps U+200B (zero-width space); a sentence segment can start
  // or end with one, so trim it on both sides with the whitespace.
  const trimmed = piece.replace(/^[\s\u200B]+|[\s\u200B]+$/g, '')
  if (trimmed.length === 0) return
  const start = from + piece.length - piece.replace(/^[\s\u200B]+/, '').length
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
