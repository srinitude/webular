// FOSS document parsing: detect format by extension, extract markdown/text.
// pdf/docx parsers load their heavy deps lazily (they never tax a text parse);
// binary formats we cannot parse fail loudly instead of decoding to garbage.
import { Effect } from 'effect'
import { logErr } from '../core/output.ts'
import { htmlToMarkdown } from './html.ts'
import { attempt, fail, ParseError } from './parse-core.ts'
import { pdfText } from './parse-pdf.ts'

export { pdfText }

type DocFormat = 'pdf' | 'docx' | 'html' | 'md' | 'txt' | 'csv' | 'json'

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

function detectFormat(file: string): Effect.Effect<DocFormat, ParseError> {
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  if (BINARY_EXTS.has(ext))
    return fail(`parse: unsupported binary format .${ext} (supported: ${SUPPORTED})`)
  return Effect.succeed(EXT_FORMATS[ext] ?? 'txt')
}

const parsePdf = Effect.fnUntraced(function* (file: string) {
  const buf = yield* attempt(() => Bun.file(file).arrayBuffer())
  return yield* pdfText(new Uint8Array(buf))
})

const parseDocx = Effect.fnUntraced(function* (file: string) {
  const { default: mammoth } = yield* attempt(() => import('mammoth'))
  const buf = yield* attempt(() => Bun.file(file).arrayBuffer())
  const { value: html, messages } = yield* attempt(() =>
    mammoth.convertToHtml({ buffer: Buffer.from(buf) }),
  ).pipe(
    Effect.mapError(
      (e) => new ParseError({ message: `parse: ${file}: docx unreadable: ${e.message}` }),
    ),
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
