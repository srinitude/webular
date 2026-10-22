// Structured-data lookup (microdata, JSON-LD, meta) for a bare field name.
import type { parseHTML } from 'linkedom'
import { jsonLdNodes } from './json-ld.ts'
import { textOf } from './select-dom.ts'

// Structured data first (Web Data Commons, Mühleisen and Bizer, LDOW 2012):
// a bare field name that names a schema.org microdata, JSON-LD, or meta
// property takes its value before any text guess. Keys fold case and drop
// punctuation, so prep_time finds prepTime; the first source to name a key wins.
export const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const MAX_LD_DEPTH = 4
export type Known = Map<string, string>
const ldValue = (v: unknown): string | undefined => {
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim() || undefined
  if (Array.isArray(v)) return ldValue(v[0])
  return v && typeof v === 'object' ? ldValue((v as Record<string, unknown>)['name']) : undefined
}
const addLd = (known: Known, node: Record<string, unknown>, depth: number): void => {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('@')) continue
    const value = ldValue(v)
    if (value && !known.has(keyOf(k))) known.set(keyOf(k), value)
    const nested = Array.isArray(v) ? v[0] : v
    if (depth < MAX_LD_DEPTH && nested && typeof nested === 'object')
      addLd(known, nested as Record<string, unknown>, depth + 1)
  }
}
const microValue = (el: Element) =>
  ['content', 'href', 'src', 'datetime'].map((a) => el.getAttribute(a)).find(Boolean) ?? textOf(el)
export const structuredValues = (document: ReturnType<typeof parseHTML>['document']): Known => {
  const known: Known = new Map()
  const add = (key: string, value: string | null | undefined) => {
    const k = keyOf(key)
    if (k && value?.trim() && !known.has(k)) known.set(k, value.trim())
  }
  for (const el of Array.from(document.querySelectorAll('[itemprop]')))
    for (const prop of (el.getAttribute('itemprop') ?? '').split(/\s+/)) add(prop, microValue(el))
  for (const node of jsonLdNodes(document)) addLd(known, node, 0)
  for (const el of Array.from(document.querySelectorAll('meta[content]'))) {
    const key = el.getAttribute('property') ?? el.getAttribute('name') ?? ''
    add(key.slice(key.lastIndexOf(':') + 1), el.getAttribute('content'))
  }
  return known
}

// Everyday names for the schema.org and og: keys that hold them.
const ALIASES: Record<string, string[]> = {
  date: ['datepublished', 'publishedtime', 'datecreated', 'datemodified'],
  offer: ['price'],
}
export const structuredOf = (known: Known, name: string) =>
  [keyOf(name), ...(ALIASES[keyOf(name)] ?? [])].map((k) => known.get(k)).find(Boolean)
