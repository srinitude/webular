// FOSS document parsing: detect format by extension, extract markdown/text.
// Supports pdf, docx, html, htm, md, txt, csv, json.
import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'
import { htmlToMarkdown } from './html.ts'

export type DocFormat = 'pdf' | 'docx' | 'html' | 'md' | 'txt' | 'csv' | 'json'

export interface ParseResult {
  file: string
  format: DocFormat
  markdown: string
}

export function detectFormat(file: string): DocFormat {
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'html' || ext === 'htm') return 'html'
  if (ext === 'md') return 'md'
  if (ext === 'csv') return 'csv'
  if (ext === 'json') return 'json'
  return 'txt'
}

async function parsePdf(file: string): Promise<string> {
  const buf = await Bun.file(file).arrayBuffer()
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const { text } = await extractText(pdf, { mergePages: true })
  return typeof text === 'string' ? text : (text as string[]).join('\n')
}

async function parseDocx(file: string): Promise<string> {
  const buf = await Bun.file(file).arrayBuffer()
  const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(buf) })
  return htmlToMarkdown(html)
}

async function parseHtml(file: string): Promise<string> {
  const html = await Bun.file(file).text()
  return htmlToMarkdown(html)
}

async function parseText(file: string): Promise<string> {
  return await Bun.file(file).text()
}

export async function parseDocument(file: string): Promise<ParseResult> {
  const format = detectFormat(file)
  let markdown: string
  if (format === 'pdf') {
    markdown = await parsePdf(file)
  } else if (format === 'docx') {
    markdown = await parseDocx(file)
  } else if (format === 'html') {
    markdown = await parseHtml(file)
  } else {
    markdown = await parseText(file)
  }
  return { file, format, markdown }
}
