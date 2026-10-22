// Bare paths: a code span or plain word in Markdown prose that names a repo path must be a link.
import { posix } from 'node:path'
import { proseLines, resolve } from './lib.ts'

// A whole link (left alone), a code span, or a plain word.
const TOKEN = /!?\[[^\]]*\]\([^)]*\)|`([^`]+)`|([^\s`[\]()<>"'|]+)/g

// Exempt: commands (spaces), globs and placeholders, URLs, absolute paths, and words with no / or dot.
const exempt = (p: string) =>
  /\s|[*?{}[\]$<>=~]|^[a-z][a-z0-9+.-]*:|^\//i.test(p) || !/[/.]/.test(p) || /^[./]+$/.test(p)

// The link target for path p named in repo-relative file, or undefined when p names nothing in the repo.
// p resolves against the file's folder first, then against the repo root.
const linkFor = (file: string, p: string, paths: ReadonlySet<string>) => {
  if (exempt(p)) return undefined
  const dir = posix.dirname(file)
  const local = resolve(file, p.replace(/\/$/, ''))
  if (paths.has(local)) return p
  const root = p.replace(/\/$/, '')
  if (p.startsWith('.') || !paths.has(root)) return undefined
  return (posix.relative(dir, root) || '.') + (p.endsWith('/') ? '/' : '')
}

type Hit = { readonly line: number; readonly path: string; readonly link: string }

// One prose line with every bare path turned into a link, plus the hits. Headings stay as they are,
// since a link inside a heading changes its anchor.
const fixLine = (file: string, text: string, line: number, paths: ReadonlySet<string>) => {
  const hits: Hit[] = []
  if (/^\s*#{1,6}\s/.test(text)) return { text, hits }
  const fixed = text.replace(TOKEN, (whole, code?: string, word?: string) => {
    // A plain word counts only with a slash: "SKILL.md" in a sentence often means any skill's file.
    const name = code ?? (word?.includes('/') ? word.replace(/[.,:;!?]+$/, '') : undefined)
    const link = name === undefined ? undefined : linkFor(file, name, paths)
    if (name === undefined || link === undefined) return whole
    hits.push({ line, path: name, link })
    return code ? `[\`${code}\`](${link})` : `[${name}](${link})${whole.slice(name.length)}`
  })
  return { text: fixed, hits }
}

// Every bare path in a Markdown text, and the text with all of them linked.
export const barePaths = (file: string, text: string, paths: ReadonlySet<string>) => {
  const lines = text.split('\n')
  const hits: Hit[] = []
  // YAML front matter is data, not prose.
  const front = /^---\n[\s\S]*?\n---\n/.exec(text)?.[0].split('\n').length ?? 0
  for (const { line, text: t } of proseLines(text).filter((l) => l.line >= front)) {
    const out = fixLine(file, t, line, paths)
    lines[line - 1] = out.text
    hits.push(...out.hits)
  }
  return { hits, fixed: lines.join('\n') }
}

// Every tracked file plus each folder above it, so folder mentions resolve too.
export const pathSet = (tracked: ReadonlyArray<string>) => {
  const all = new Set<string>()
  for (const f of tracked)
    for (let p = f; p !== '.' && !all.has(p); p = posix.dirname(p)) all.add(p)
  return all
}
