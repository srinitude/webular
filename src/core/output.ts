// clig.dev output discipline: machine data to stdout, logs to stderr,
// optional file sink via -o, structured JSON via --json. The -o file receives
// exactly what stdout would have carried.
//
// Token rules shared by the CLI and the MCP server: sorted-key JSON (same value,
// same bytes), compact JSON unless a person is reading a TTY, field selection,
// NDJSON, and lossless cursor paging under a fixed character cap.
import { Data, Effect, type FileSystem, type Path } from 'effect'
import { outPath, type SandboxError } from './safepath.ts'

export class OutputError extends Data.TaggedError('OutputError')<{ readonly message: string }> {}

export function logErr(msg: string): Effect.Effect<void> {
  return Effect.sync(() => {
    process.stderr.write(`${msg}\n`)
  })
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// One line, at most ERROR_MAX_CHARS: errors cost tokens on every failed call.
export const ERROR_MAX_CHARS = 300
export function shortError(err: unknown): string {
  const line = errMsg(err).split('\n', 1)[0] ?? ''
  return line.length > ERROR_MAX_CHARS
    ? `${line.slice(0, ERROR_MAX_CHARS - 1).toWellFormed()}…`
    : line
}

// Plain text as one Markdown heading line: NFC, no zero-width marks, whitespace
// and newlines collapsed, and inline syntax (links, emphasis, code, tables, #) escaped.
export const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g
export const mdHeading = (text: string): string =>
  text
    .normalize('NFC')
    .replace(ZERO_WIDTH, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\`*_[\]()<>#|]/g, '\\$&')

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const byKey = ([a]: [string, unknown], [b]: [string, unknown]): number =>
  a < b ? -1 : a > b ? 1 : 0

// Keys sorted at every depth, so output never depends on build order.
export function stableJson(data: unknown, indent?: number): string {
  return JSON.stringify(
    data,
    (_key, value: unknown) =>
      isRec(value) ? Object.fromEntries(Object.entries(value).sort(byKey)) : value,
    indent,
  )
}

// Rough token estimate (about 4 characters per token) used by the budget tests.
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4)

// Keep only the named top-level fields; unknown names are skipped.
export function selectFields(data: unknown, fields: readonly string[] | undefined): unknown {
  if (!fields?.length || !isRec(data)) return data
  return Object.fromEntries(fields.filter((f) => f in data).map((f) => [f, data[f]]))
}

export const parseFields = (raw: string | undefined): string[] | undefined =>
  raw
    ?.split(',')
    .map((f) => f.trim())
    .filter(Boolean)

// One compact JSON line per item of the first array field (or the value itself).
export function toNdjson(data: unknown): string {
  const list = isRec(data) ? Object.values(data).find(Array.isArray) : undefined
  return (list ?? [data]).map((item) => stableJson(item)).join('\n')
}

// Fixed page size for tool results: about 5,000 tokens.
export const PAGE_MAX_CHARS = 20_000
type Page =
  | { ok: true; text: string; nextCursor?: string; totalChars: number }
  | { ok: false; error: string }

// Lossless paging: the cursor is the character offset of the next page, so the
// pages joined in order equal the full text. Never splits a surrogate pair.
export function pageText(text: string, cursor?: string, maxChars = PAGE_MAX_CHARS): Page {
  const start = cursor === undefined ? 0 : Number(cursor)
  if (!Number.isInteger(start) || start < 0 || start > text.length) {
    return { ok: false, error: 'cursor: use the nextCursor value from the previous page' }
  }
  let end = Math.min(start + maxChars, text.length)
  const code = text.charCodeAt(end - 1)
  if (end < text.length && end - start > 1 && code >= 0xd800 && code <= 0xdbff) end -= 1
  const page = { ok: true as const, text: text.slice(start, end), totalChars: text.length }
  return end < text.length ? { ...page, nextCursor: String(end) } : page
}

interface EmitOptions {
  json?: boolean | undefined
  ndjson?: boolean | undefined
  fields?: string[] | undefined
  output?: string | undefined
  render?: ((data: unknown) => string) | undefined
}

function defaultRender(data: unknown): string {
  if (typeof data === 'string') return data
  if (data && typeof data === 'object' && 'markdown' in data) {
    return String((data as { markdown: unknown }).markdown)
  }
  return stableJson(data, 2)
}

// Pretty JSON only for a person at a terminal; pipes, files, and agents get one line.
const jsonIndent = (toFile: boolean): number | undefined =>
  !toFile && process.stdout.isTTY ? 2 : undefined

export function formatOutput(data: unknown, opts: EmitOptions): string {
  const picked = selectFields(data, opts.fields)
  if (opts.ndjson) return toNdjson(picked)
  if (opts.json || opts.fields) return stableJson(picked, jsonIndent(Boolean(opts.output)))
  return (opts.render ?? defaultRender)(data)
}

function writeFile(path: string, text: string): Effect.Effect<void, OutputError> {
  return Effect.tryPromise({
    try: () => Bun.write(path, text),
    catch: (err) => new OutputError({ message: `write ${path}: ${errMsg(err)}` }),
  }).pipe(Effect.asVoid)
}

export function emit(
  data: unknown,
  opts: EmitOptions,
): Effect.Effect<void, OutputError | SandboxError, FileSystem.FileSystem | Path.Path> {
  const text = formatOutput(data, opts)
  if (opts.output) return Effect.flatMap(outPath(opts.output), (path) => writeFile(path, text))
  return Effect.sync(() => {
    process.stdout.write(`${text}\n`)
  })
}
