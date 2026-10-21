// Jev payloads: canonical, capped bytes for every decision.
// A payload is a nested state (purpose first, then decisive facts, then
// context) plus typed questions that point at state fields by backticked path.
// Every walk below stops at a fixed cap, so building, hashing, and sending a
// payload costs O(1) time and memory no matter how big the page or crawl is.

// Caps (docs.typesafe.ai /models, /primitives/choice, /primitives/score): the
// API takes up to 64 nesting levels, a 32 MiB body, 255 Choice options (reliable
// to about 240), and 2 to 10 Score levels. These stay well under them.
export const CAPS = {
  depth: 16, // nesting levels below the top of `state`
  fields: 20, // keys per object, items per array, questions per request
  options: 240, // options per Choice
  levels: 10, // levels per Score (at least 2)
  nodes: 4_096, // values walked per payload
  chars: 6_000, // characters per string (the longest field today is a 6,000-char diff)
  keyChars: 64, // characters per key
  bytes: 262_144, // serialized bytes of state plus questions: 256 KiB
} as const

// Jev's per-question context is 32k tokens, and `state` counts once against it
// (docs.typesafe.ai/models#context-length). A token is about 4 chars, so a
// payload past this cap is refused before the call and the fallback decides.
export const JEV_TOKEN_CAP = 32_000
export const payloadTokens = (body: string) => Math.ceil(body.length / 4)

interface Budget {
  bytes: number
  nodes: number
  fields: number
}

// Interned constant prefixes: a purpose serializes once and carries its bytes
// under this symbol, so every payload reuses that string instead of copying it.
const INTERNED: unique symbol = Symbol('webular/jev/interned')
type Interned = { readonly [INTERNED]?: string }

interface Purpose {
  readonly motivation: string
  readonly outcome: string
  readonly why: string
  readonly background: string
}
export const purpose = (
  motivation: string,
  outcome: string,
  why: string,
  background: string,
): Purpose => {
  const p = { motivation, outcome, why, background }
  Object.defineProperty(p, INTERNED, { value: JSON.stringify(p) })
  return Object.freeze(p)
}

// One JSON string, cut to `max` chars and to what is left of the byte budget.
const str = (s: string, max: number, b: Budget): string => {
  let j = JSON.stringify(s.length > max ? s.slice(0, max) : s)
  if (j.length > b.bytes) j = JSON.stringify(s.slice(0, Math.max(0, Math.floor((b.bytes - 2) / 6))))
  b.bytes -= j.length
  return j
}

// Takes at most `max` own keys without listing the whole object.
// ponytail: an object with more than `max` keys keeps its first `max` in
// insertion order, so two such objects built in different orders can differ;
// cap the source list (as every payload builder here does) to stay canonical.
const firstKeys = (o: object, max: number): string[] => {
  const keys: string[] = []
  for (const k in o) {
    if (!Object.hasOwn(o, k)) continue
    keys.push(k)
    if (keys.length === max) break
  }
  return keys
}

const write = (v: unknown, depth: number, b: Budget, out: string[]): void => {
  const pre = typeof v === 'object' && v !== null ? (v as Interned)[INTERNED] : undefined
  if (pre !== undefined) return void out.push(pre)
  if (--b.nodes < 0 || depth > CAPS.depth || b.bytes <= 2) return void out.push('null')
  if (typeof v === 'string') return void out.push(str(v, CAPS.chars, b))
  if (typeof v === 'number') return void out.push(Number.isFinite(v) ? String(v) : 'null')
  if (typeof v === 'boolean') return void out.push(v ? 'true' : 'false')
  if (typeof v !== 'object' || v === null) return void out.push('null')
  if (Array.isArray(v)) {
    out.push('[')
    const n = Math.min(v.length, b.fields)
    for (let i = 0; i < n; i++) {
      if (i) out.push(',')
      write(v[i], depth + 1, b, out)
    }
    return void out.push(']')
  }
  // Keys sort, so equal data built in another order gives equal bytes.
  const keys = firstKeys(v, b.fields).sort()
  out.push('{')
  keys.forEach((k, i) => {
    if (i) out.push(',')
    out.push(str(k, CAPS.keyChars, b), ':')
    write((v as Record<string, unknown>)[k], depth + 1, b, out)
  })
  out.push('}')
}

// Canonical bytes of one value: sorted keys, finite numbers, capped lists and
// strings. The cache key is the hash of these bytes, and they are what is posted.
export const canonical = (
  v: unknown,
  b: Budget = { bytes: CAPS.bytes, nodes: CAPS.nodes, fields: CAPS.fields },
) => {
  const out: string[] = []
  write(v, 0, b, out)
  return out.join('')
}

interface JevQuestionShape {
  readonly type: 'noul' | 'choice' | 'score'
  readonly instructions: string
  readonly criteria?: Record<string, string | null> | ReadonlyArray<string>
}

// The request body Jev gets. `model` is required by the API, so it is always
// first. One shared byte budget bounds state and questions; questions may
// carry up to CAPS.options Choice options per object.
export const requestBytes = (
  model: string,
  state: unknown,
  questions: Record<string, JevQuestionShape>,
): string => {
  const b = { bytes: CAPS.bytes, nodes: CAPS.nodes, fields: CAPS.fields }
  const s = canonical(state, b)
  const q = canonical(questions, { ...b, fields: CAPS.options })
  return `{"model":${JSON.stringify(model)},"state":${s},"questions":${q}}`
}

// 64-bit wyhash of the canonical bytes: the cache key.
// ponytail: a 64-bit hash can collide (about 1 in 10^19 per pair); store the bytes too if that ever matters.
export const cacheKey = (bytes: string): bigint => BigInt(Bun.hash(bytes))
