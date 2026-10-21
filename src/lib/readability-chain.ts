// Readability chain for answer and research output, in order: the
// rich-and-native-markdown check, then the human-language check. The text
// stays exactly as given; the findings ride along in a `readability` field.
import { resolve } from 'node:path'
import { Effect, FileSystem } from 'effect'
import { z } from 'zod'
import { proseIssues } from '../../plugins/webular/skills/human-language/scripts/plain.ts'
import { checkMarkdown } from '../../plugins/webular/skills/rich-and-native-markdown/scripts/check.ts'

export const readabilitySchema = z.object({
  markdown: z.array(z.string()),
  plain: z.array(z.string()),
})

const page = 'output.md'

// The output is one in-memory page, so any other local link target is missing.
const pageFs = (text: string) =>
  FileSystem.layerNoop({
    readFileString: () => Effect.succeed(text),
    exists: (path) => Effect.succeed(path === resolve(page)),
  })

export const readabilityChain = Effect.fn('readabilityChain')(function* (text: string) {
  const markdown = yield* checkMarkdown([page]).pipe(Effect.provide(pageFs(text)))
  const plain = proseIssues(text)
  const readability = { markdown: [...markdown.errors, ...markdown.needs_review], plain }
  return { text, readability }
})

// Adds the chain's findings to a workflow output whose `key` field holds the text.
export const withReadability =
  <K extends string>(key: K) =>
  <O extends Record<K, string>>(out: O) =>
    Effect.map(readabilityChain(out[key]), ({ readability }) => ({ ...out, readability }))
