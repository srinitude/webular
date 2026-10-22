// Public per-token rates, in dollars per million tokens, for pricing
// subscription runs. Source: https://platform.claude.com/docs/en/about-claude/pricing
// read 2026-10-21. Haiku uses its tier for prompts up to 100,000 tokens.
// ponytail: one tier per model; split Haiku by per-request prompt size if long prompts show up.
export const RATES_SOURCE =
  'https://platform.claude.com/docs/en/about-claude/pricing (read 2026-10-21)'

interface Rate {
  input: number
  cacheWrite: number
  cacheRead: number
  output: number
}

const RATES: Record<string, Rate> = {
  'claude-opus-5-5': { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 },
  'claude-sonnet-5-5': { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 },
  'claude-haiku-5-5': { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

// null for a model with no listed rate, so a report never shows a made-up cost.
export const costUsd = (model: string, u: Usage): number | null => {
  const r = RATES[model]
  if (!r) return null
  const dollars =
    u.inputTokens * r.input +
    u.cacheWriteTokens * r.cacheWrite +
    u.cacheReadTokens * r.cacheRead +
    u.outputTokens * r.output
  return Math.round(dollars) / 1e6
}
