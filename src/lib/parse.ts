// FOSS document parsing: detect format by extension, extract markdown/text.
// pdf/docx parsers load their heavy deps lazily (they never tax a text parse);
// binary formats we cannot parse fail loudly instead of decoding to garbage.
import { Data, Effect } from 'effect'
import { errMsg, logErr } from '../core/output.ts'
import { htmlToMarkdown, sanitizeHtml } from './html.ts'

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

// PDF bytes to text; scrape reads a fetched PDF through this same reader.
export const pdfText = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const { extractText, getDocumentProxy } = yield* attempt(() => import('unpdf'))
  // The pdf.js proxy holds a worker and page buffers: free it on success and failure.
  return yield* Effect.acquireRelease(
    attempt(() => getDocumentProxy(bytes)),
    (pdf) =>
      Effect.ignore(attempt(() => (pdf as unknown as { destroy(): Promise<void> }).destroy())),
  ).pipe(
    Effect.flatMap((pdf) => attempt(() => extractText(pdf, { mergePages: true }))),
    Effect.map(({ text }) => (typeof text === 'string' ? text : (text as string[]).join('\n'))),
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
  return htmlToMarkdown(sanitizeHtml(html))
})

const parseHtml = (file: string) =>
  attempt(() => Bun.file(file).text()).pipe(
    Effect.map((html) => htmlToMarkdown(sanitizeHtml(html))),
  )

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

export const parseDocument = Effect.fn('parseDocument')(function* (file: string) {
  const format = yield* detectFormat(file)
  return { file, format, markdown: yield* contentOf(file, format) }
})
