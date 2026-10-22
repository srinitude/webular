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

// Pages wrap blocks in an HTML comment or a CDATA section (with or without a
// JS comment prefix), start with a BOM, or leave a trailing comma; none of that is data.
const OPEN_WRAP = /^(?:<!--|(?:\/\/|\/\*)?\s*<!\[CDATA\[(?:\*\/)?)/
const CLOSE_WRAP = /(?:-->|(?:\/\/|\/\*)?\s*\]\]>(?:\*\/)?)$/
const unwrap = (text: string): string =>
  text
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(OPEN_WRAP, '')
    .replace(CLOSE_WRAP, '')
    .trim()
// Strings are matched first so a comma inside one is never touched.
const dropTrailingCommas = (text: string): string =>
  text.replace(/"(?:[^"\\]|\\.)*"|,(\s*[}\]])/g, (m, tail?: string) => tail ?? m)
const parseBlock = (text: string) => {
  const clean = unwrap(text)
  return Option.orElse(parseJson(clean), () => parseJson(dropTrailingCommas(clean)))
}

type Node = Record<string, unknown>
const isNode = (v: unknown): v is Node => typeof v === 'object' && v !== null && !Array.isArray(v)

// Real pages nest a few levels; deeper input is hostile and would overflow the stack.
const MAX_NESTING = 16

// Every object in a block: the block itself, array members, and @graph members.
function nodesOf(value: unknown, depth = 0): Node[] {
  if (depth > MAX_NESTING) return []
  if (Array.isArray(value)) return value.flatMap((v) => nodesOf(v, depth + 1))
  if (!isNode(value)) return []
  return [value, ...nodesOf(value['@graph'], depth + 1)]
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

// Nodes of one block: none when it is oversized or malformed.
const blockNodes = (text: string): Node[] =>
  text.length > JSON_LD_MAX_BLOCK_CHARS
    ? []
    : Option.match(parseBlock(text), { onNone: () => [], onSome: (v) => nodesOf(v) })

// Every JSON-LD node on the page, for readers of keys beyond the facts below.
export const jsonLdNodes = (document: DomDocument): Node[] =>
  Array.from(document.querySelectorAll('script[type="application/ld+json" i]')).flatMap((script) =>
    blockNodes(script.textContent ?? ''),
  )

// The page's JSON-LD facts, or undefined when it has none.
export function pageMetadata(document: DomDocument): PageMetadata | undefined {
  const facts = jsonLdNodes(document)
    .map(factOf)
    .filter((fact) => Object.keys(fact).length > 0)
    .slice(0, JSON_LD_MAX_FACTS)
  return facts.length ? { jsonLd: facts } : undefined
}
