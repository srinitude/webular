// FOSS document parsing: detect format by extension, extract markdown/text.
// pdf/docx parsers load their heavy deps lazily (they never tax a text parse);
// binary formats we cannot parse fail loudly instead of decoding to garbage.
import { htmlToMarkdown } from './html.ts'

type DocFormat = 'pdf' | 'docx' | 'html' | 'md' | 'txt' | 'csv' | 'json'

interface ParseResult {
  file: string
  format: DocFormat
  markdown: string
}

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

function detectFormat(file: string): DocFormat {
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  if (BINARY_EXTS.has(ext))
    throw new Error(`parse: unsupported binary format .${ext} (supported: ${SUPPORTED})`)
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'html' || ext === 'htm') return 'html'
  if (ext === 'md') return 'md'
  if (ext === 'csv') return 'csv'
  if (ext === 'json') return 'json'
  return 'txt'
}

async function parsePdf(file: string): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const buf = await Bun.file(file).arrayBuffer()
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const { text } = await extractText(pdf, { mergePages: true })
  return typeof text === 'string' ? text : (text as string[]).join('\n')
}

async function parseDocx(file: string): Promise<string> {
  const { default: mammoth } = await import('mammoth')
  const buf = await Bun.file(file).arrayBuffer()
  const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(buf) })
  return htmlToMarkdown(html)
}

async function parseHtml(file: string): Promise<string> {
  const html = await Bun.file(file).text()
  return htmlToMarkdown(html)
}

// Extension checks can be fooled; NUL bytes in the head cannot.
async function parseText(file: string): Promise<string> {
  const text = await Bun.file(file).text()
  if (text.slice(0, 4096).includes('\u0000'))
    throw new Error(`parse: ${file} looks binary (NUL bytes) — supported: ${SUPPORTED}`)
  return text
}

// Fenced blocks ARE markdown — this keeps the "documents to markdown" claim
// true for csv/json without a fragile format-specific converter.
async function parseFenced(file: string, format: 'csv' | 'json'): Promise<string> {
  const text = await parseText(file)
  return `\`\`\`${format}\n${text.trimEnd()}\n\`\`\``
}

async function contentOf(file: string, format: DocFormat): Promise<string> {
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

export async function parseDocument(file: string): Promise<ParseResult> {
  const format = detectFormat(file)
  return { file, format, markdown: await contentOf(file, format) }
}
