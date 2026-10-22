// FOSS document parsing: detect format by extension, extract markdown/text.
// pdf/docx parsers load their heavy deps lazily (they never tax a text parse);
// binary formats we cannot parse fail loudly instead of decoding to garbage.
import { Config, Data, Effect, Option } from 'effect'
import { errMsg, logErr } from '../core/output.ts'
import { htmlToMarkdown } from './html.ts'

type DocFormat = 'pdf' | 'docx' | 'html' | 'md' | 'txt' | 'csv' | 'json'

class ParseError extends Data.TaggedError('ParseError')<{ readonly message: string }> {}

const SUPPORTED = 'pdf, docx, html, md, txt, csv, json'

const BINARY_EXTS = new Set([
  'xlsx',
  'xls',
  'pptx',
  'ppt',
  'doc',
  'zip',
  'gz',
  'tar',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'mp3',
  'mp4',
  'wasm',
  'exe',
  'bin',
])

const EXT_FORMATS: Record<string, DocFormat> = {
  pdf: 'pdf',
  docx: 'docx',
  html: 'html',
  htm: 'html',
  md: 'md',
  csv: 'csv',
  json: 'json',
}

const fail = (message: string) => Effect.fail(new ParseError({ message }))
const attempt = <A>(run: () => PromiseLike<A>) =>
  Effect.tryPromise({
    try: () => Promise.resolve(run()),
    catch: (e) => new ParseError({ message: errMsg(e) }),
  })

function detectFormat(file: string): Effect.Effect<DocFormat, ParseError> {
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  if (BINARY_EXTS.has(ext))
    return fail(`parse: unsupported binary format .${ext} (supported: ${SUPPORTED})`)
  return Effect.succeed(EXT_FORMATS[ext] ?? 'txt')
}

// A page cap and a deadline bound one PDF's text extraction (CPU and memory).
// unpdf reads a dense text page in about 10 ms on an Apple-silicon Mac, so the
// 2,000-page cap takes about 20 s and the 60 s deadline leaves 3x headroom for
// heavier pages and slower hosts. 2,000 pages covers 10-K filings and most long
// government reports. WEBULAR_PDF_MAX_PAGES and WEBULAR_PDF_TIMEOUT_MS override them.
const setting = (name: string, fallback: number) =>
  Config.Int(name).pipe(
    Config.withDefault(fallback),
    Effect.mapError((e) => new ParseError({ message: `parse: ${name}: ${errMsg(e)}` })),
  )

type Pdf = Awaited<ReturnType<typeof import('unpdf').getDocumentProxy>>

// One page's text, joined the way unpdf's extractText joins it.
const pageText = (pdf: Pdf, n: number) =>
  attempt(() => pdf.getPage(n)).pipe(
    Effect.flatMap((page) => attempt(() => page.getTextContent())),
    Effect.map(({ items }) =>
      items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : '')).join(''),
    ),
  )

// pdf.js extraction runs on promise jobs only, so no timer (the deadline) fires
// mid-document. Reading page by page with a yield between pages lets the
// deadline interrupt, and `texts` keeps every page read before it.
const readPages = (pdf: Pdf, last: number, texts: string[]) =>
  Effect.gen(function* () {
    for (let n = 1; n <= last; n++) {
      texts.push(yield* pageText(pdf, n))
      yield* Effect.yieldNow
    }
  })

// unpdf's mergePages whitespace rules, so output matches a whole-document read.
const merge = (texts: string[]) =>
  texts
    .join('\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')

// The cap or the deadline stops early: the pages read before the stop come back
// with a truncation note naming the setting. Only a stop before page 1 fails.
const readBounded = Effect.fnUntraced(function* (pdf: Pdf, maxPages: number, timeoutMs: number) {
  const texts: string[] = []
  const done = yield* readPages(pdf, Math.min(pdf.numPages, maxPages), texts).pipe(
    Effect.timeoutOption(timeoutMs),
  )
  if (texts.length === pdf.numPages) return merge(texts)
  const stop = Option.isNone(done)
    ? `WEBULAR_PDF_TIMEOUT_MS: over ${timeoutMs} ms`
    : `WEBULAR_PDF_MAX_PAGES: ${maxPages}-page cap`
  if (texts.length === 0) return yield* fail(`parse: PDF text stopped before page 1 (${stop})`)
  return `${merge(texts)}\n\n[truncated at page ${texts.length} of ${pdf.numPages} (${stop})]`
})

// PDF bytes to text; scrape reads a fetched PDF through this same reader.
export const pdfText = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const maxPages = yield* setting('WEBULAR_PDF_MAX_PAGES', 2_000)
  const timeoutMs = yield* setting('WEBULAR_PDF_TIMEOUT_MS', 60_000)
  const { getDocumentProxy } = yield* attempt(() => import('unpdf'))
  // The pdf.js proxy holds a worker and page buffers: free it on success and failure.
  return yield* Effect.acquireRelease(
    attempt(() => getDocumentProxy(bytes.slice())), // pdf.js detaches its input: pass a copy
    (pdf) =>
      Effect.ignore(attempt(() => (pdf as unknown as { destroy(): Promise<void> }).destroy())),
  ).pipe(
    Effect.flatMap((pdf) => readBounded(pdf, maxPages, timeoutMs)),
    Effect.scoped,
  )
})

const parsePdf = Effect.fnUntraced(function* (file: string) {
  const buf = yield* attempt(() => Bun.file(file).arrayBuffer())
  return yield* pdfText(new Uint8Array(buf))
})

const parseDocx = Effect.fnUntraced(function* (file: string) {
  const { default: mammoth } = yield* attempt(() => import('mammoth'))
  const buf = yield* attempt(() => Bun.file(file).arrayBuffer())
  const { value: html, messages } = yield* attempt(() =>
    mammoth.convertToHtml({ buffer: Buffer.from(buf) }),
  )
  for (const m of messages) yield* logErr(`parse: ${file}: mammoth ${m.type}: ${m.message}`)
  return htmlToMarkdown(html)
})

const parseHtml = (file: string) =>
  attempt(() => Bun.file(file).text()).pipe(Effect.map((html) => htmlToMarkdown(html)))

// Extension checks can be fooled; NUL bytes in the head cannot.
const parseText = Effect.fnUntraced(function* (file: string) {
  const text = yield* attempt(() => Bun.file(file).text())
  if (text.slice(0, 4096).includes('\u0000'))
    return yield* fail(`parse: ${file} looks binary (NUL bytes) — supported: ${SUPPORTED}`)
  return text
})

// Fenced blocks ARE markdown — this keeps the "documents to markdown" claim
// true for csv/json without a fragile format-specific converter.
const parseFenced = (file: string, format: 'csv' | 'json') =>
  parseText(file).pipe(Effect.map((text) => `\`\`\`${format}\n${text.trimEnd()}\n\`\`\``))

function contentOf(file: string, format: DocFormat): Effect.Effect<string, ParseError> {
  switch (format) {
    case 'pdf':
      return parsePdf(file)
    case 'docx':
      return parseDocx(file)
    case 'html':
      return parseHtml(file)
    case 'csv':
    case 'json':
      return parseFenced(file, format)
    default:
      return parseText(file)
  }
}

// Every parser reads the whole file into memory: stat it against a budget first.
const MAX_PARSE_BYTES = 64 * 1024 * 1024

const checkSize = Effect.fnUntraced(function* (file: string) {
  const { size } = yield* attempt(() => Bun.file(file).stat())
  if (size > MAX_PARSE_BYTES)
    return yield* fail(`parse: ${file} is too large (${size} bytes; limit ${MAX_PARSE_BYTES})`)
})

export const parseDocument = Effect.fn('parseDocument')(function* (file: string) {
  const format = yield* detectFormat(file)
  yield* checkSize(file)
  return { file, format, markdown: yield* contentOf(file, format) }
})
