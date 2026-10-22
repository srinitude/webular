// The multi-hop helpers of the research search rounds: keywords and the bridge entity.
// A question as search keywords: the wh- lead ("In which city was") and the "?" go.
export const keywordQuery = (topic: string): string =>
  topic
    .replace(
      /^\s*(?:(?:in|at|of|for|from|by)\s+)?(?:which|what|who|whom|whose|where|when|how)\b(?:\s+\w+)??\s+(?:was|were|is|are|did|does|do|has|had)\s+/i,
      '',
    )
    .replace(/[?.!]+\s*$/, '')
    .trim()

const words = (s: string) => s.toLowerCase().match(/[a-z]{4,}/g) ?? []
// One sentence's names, each scored by how many topic words share its sentence.
const sentenceNames = (sentence: string, inTopic: ReadonlySet<string>) => {
  const score = new Set(words(sentence).filter((w) => inTopic.has(w))).size
  return (sentence.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) ?? [])
    .filter((n) => !words(n).some((w) => inTopic.has(w)))
    .map((n) => [n, score] as const)
}

// The bridge entity of a multi-hop question: a multi-word capitalized name the
// topic does not hold, from the sentence that shares the most topic words.
// ponytail: capitalized-run heuristic; a named-entity decision if bridges are missed.
export const bridgeEntity = (topic: string, texts: ReadonlyArray<string>): string | undefined => {
  const inTopic = new Set(words(topic))
  let best: readonly [string, number] | undefined
  for (const e of texts
    .flatMap((t) => t.split(/(?<=[.!?])\s+/))
    .flatMap((s) => sentenceNames(s, inTopic)))
    if (e[1] > 0 && (!best || e[1] > best[1])) best = e
  return best?.[0]
}
