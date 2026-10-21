// Guard 15: recordings and reports hold no API key, token, or cookie. Each
// pattern names one common key shape; a hit names the shape, never the value.
import { Effect, FileSystem } from 'effect'

export const SECRET_SHAPES: ReadonlyArray<readonly [string, RegExp]> = [
  ['sk- key', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['xai key', /\bxai-[A-Za-z0-9]{20,}/],
  ['bearer token', /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/],
  ['github token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/],
  ['aws access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['cookie header', /\b(?:set-)?cookie["']?\s*[:=]\s*["']?[^\s"';=]+=[^\s"';]+/i],
  ['tavily key', /\btvly-[A-Za-z0-9_-]{20,}/],
  ['firecrawl key', /\bfc-[A-Za-z0-9]{32}\b/],
  ['exa key', /\b(?:x-api-key|exa[_-]?api[_-]?key)["']?\s*[:=]\s*["']?[A-Za-z0-9-]{16,}/i],
]

// The shape names found in one text; empty means clean.
export const scanSecrets = (text: string): string[] =>
  SECRET_SHAPES.filter(([, re]) => re.test(text)).map(([name]) => name)

// Each file that holds a key shape, with the shapes found.
export const scanFiles = (files: readonly string[]) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    Effect.forEach(
      files,
      (file) =>
        Effect.map(fs.readFileString(file), (text) => ({ file, shapes: scanSecrets(text) })),
      { concurrency: 4 },
    ).pipe(Effect.map((all) => all.filter((hit) => hit.shapes.length > 0))),
  )
