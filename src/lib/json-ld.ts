// JSON-LD facts: reads <script type="application/ld+json"> blocks as text only
// (nothing runs), skips oversized or malformed blocks, and flattens arrays and
// @graph into typed facts for the metadata that scrape and extract return.
import { Option, Schema } from 'effect'
import type { parseHTML } from 'linkedom'
import { z } from 'zod'

type DomDocument = ReturnType<typeof parseHTML>['document']

// A block longer than this many characters (64 KiB of ASCII) is skipped.
export const JSON_LD_MAX_BLOCK_CHARS = 64 * 1024
// Facts kept per page, so a hostile page cannot grow the result without bound.
const JSON_LD_MAX_FACTS = 50

const jsonLdFactSchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  datePublished: z.string().optional(),
  author: z.array(z.string()).optional(),
  sameAs: z.array(z.string()).optional(),
})
type JsonLdFact = z.infer<typeof jsonLdFactSchema>

export const metadataSchema = z.object({ jsonLd: z.array(jsonLdFactSchema) })
export type PageMetadata = z.infer<typeof metadataSchema>

const parseJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))

type Node = Record<string, unknown>
const isNode = (v: unknown): v is Node => typeof v === 'object' && v !== null && !Array.isArray(v)

// Every object in a block: the block itself, array members, and @graph members.
function nodesOf(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodesOf)
  if (!isNode(value)) return []
  return [value, ...nodesOf(value['@graph'])]
}

const asStrings = (v: unknown): string[] =>
  (Array.isArray(v) ? v : [v]).filter((s): s is string => typeof s === 'string' && s !== '')

// An author is a name string or a Person/Organization object with a name.
const authorNames = (v: unknown): string[] =>
  (Array.isArray(v) ? v : [v]).flatMap((a) => (isNode(a) ? asStrings(a['name']) : asStrings(a)))

function factOf(node: Node): JsonLdFact {
  const [name] = asStrings(node['name'])
  const [url] = asStrings(node['url'])
  const [datePublished] = asStrings(node['datePublished'])
  const author = authorNames(node['author'])
  const sameAs = asStrings(node['sameAs'])
  return {
    ...(name ? { name } : {}),
    ...(url ? { url } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(author.length ? { author } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  }
}

// The page's JSON-LD facts, or undefined when it has none.
export function pageMetadata(document: DomDocument): PageMetadata | undefined {
  const facts: JsonLdFact[] = []
  for (const script of document.querySelectorAll('script[type="application/ld+json" i]')) {
    const text = script.textContent ?? ''
    if (text.length > JSON_LD_MAX_BLOCK_CHARS) continue
    for (const node of Option.getOrElse(Option.map(parseJson(text), nodesOf), () => [])) {
      const fact = factOf(node)
      if (Object.keys(fact).length) facts.push(fact)
    }
  }
  return facts.length ? { jsonLd: facts.slice(0, JSON_LD_MAX_FACTS) } : undefined
}
