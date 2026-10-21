// Docs snapshot: the verified record of the model's own docs. Every limit comes from
// the docs text; a missing one fails the parse, never a guess.
import committed from './docs-snapshot.json' with { type: 'json' }

export interface DocsLimits {
  readonly bodyBytes: number
  readonly nesting: number
  readonly choiceMax: number
  readonly scoreMin: number
  readonly scoreMax: number
  readonly types: readonly string[]
}
export interface Headers {
  readonly etag?: string | undefined
  readonly lastModified?: string | undefined
}
export interface DocsSnapshot extends Headers {
  readonly model: string
  readonly url: string
  readonly sha256: string
  readonly lines: number
  readonly chunks: ReadonlyArray<readonly [number, number]>
  readonly limits: DocsLimits
  readonly verified: boolean
}
export interface DecisionModel {
  readonly id: string
  readonly docs: string | undefined // undefined: registered, unverified, always refused
  readonly models: RegExp
}
// Aliases and ids from docs.typesafe.ai/models. The OpenRouter decisions list
// (openrouter.ai/models?output_modalities=decisions) serves Jev as
// ~typesafe/jev-latest; its request rules are TypeSafe's, so it reads the same docs.
export const DECISION_MODELS: readonly DecisionModel[] = [
  {
    id: 'typesafe',
    docs: 'https://docs.typesafe.ai/llms-full.txt',
    models: /^jev-(latest|preview|\d+\.\d+(\.\d+)?)$/,
  },
  {
    id: 'openrouter-decisions',
    docs: 'https://docs.typesafe.ai/llms-full.txt',
    models: /^~typesafe\/jev-/,
  },
]
const CHUNK_LINES = 8200

const num = (text: string, re: RegExp, words: Record<string, number> = {}) => {
  const m = re.exec(text)?.[1]
  const n = m === undefined ? Number.NaN : (words[m] ?? Number(m))
  return Number.isFinite(n) ? n : undefined
}
export const parseLimits = (text: string): DocsLimits | undefined => {
  const bodyMiB = num(text, /Body size \| At most (\d+) MiB/)
  const nesting = num(text, /At most (\d+) nested levels/)
  const choiceMax = num(text, /`Choice` question allows at most (\d+) options/)
  const scoreMax = num(text, /the API accepts up to (\d+)\./)
  const scoreMin = num(text, /Should have at least (\w+) levels/, { two: 2, three: 3 })
  if (bodyMiB === undefined || nesting === undefined || choiceMax === undefined) return undefined
  if (scoreMax === undefined || scoreMin === undefined) return undefined
  const types = ['noul', 'choice', 'score', 'box'].filter((t) => text.includes(`"type": "${t}"`))
  return { bodyBytes: bodyMiB * 1024 * 1024, nesting, choiceMax, scoreMin, scoreMax, types }
}

const sha256 = (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('hex')
const lineCount = (text: string) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
const chunksOf = (lines: number, size: number = CHUNK_LINES) =>
  Array.from(
    { length: Math.ceil(lines / size) },
    (_, i) => [i * size + 1, Math.min((i + 1) * size, lines)] as const,
  )

// The proof: the hash, the line count, and chunk boundaries that reach the last line.
export const prove = (
  model: string,
  url: string,
  text: string,
  h: Headers,
): DocsSnapshot | undefined => {
  const limits = parseLimits(text)
  if (limits === undefined) return undefined
  const lines = lineCount(text)
  return {
    model,
    url,
    etag: h.etag,
    lastModified: h.lastModified,
    sha256: sha256(text),
    lines,
    chunks: chunksOf(lines),
    limits,
    verified: true,
  }
}

export const committedSnapshot = committed as unknown as DocsSnapshot
