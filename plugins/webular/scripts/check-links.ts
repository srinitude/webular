// Links: every relative Markdown link resolves to a repo file or folder, every #anchor and #L line
// anchor exists, and no prose names a repo path without linking it. Scope is plugins/webular, or
// every tracked Markdown file with --repo. --fix rewrites bare paths into links.
import { Effect, FileSystem } from 'effect'
import { barePaths, pathSet } from './bare-paths.ts'
import {
  exists,
  files,
  isExternal,
  links,
  pluginDir,
  proseLines,
  read,
  rel,
  repoRoot,
  resolve,
  run,
  tracked,
} from './lib.ts'

// GitHub-style heading slug.
export const slug = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')

export const anchors = (text: string) =>
  new Set(
    proseLines(text).flatMap(({ text: t }) =>
      /^#{1,6}\s+(.*)$/.exec(t) ? [slug(t.replace(/^#+\s+/, ''))] : [],
    ),
  )

// A GitHub line anchor (L10 or L10-L20) holds when every named line exists in text.
export const lineAnchorOk = (anchor: string, text: string) => {
  const m = /^L(\d+)(?:-L(\d+))?$/.exec(anchor)
  const count = text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length
  return m !== null && Number(m[1]) >= 1 && Number(m[2] ?? m[1]) <= count
}

// The problem with one link in file, or undefined when it resolves.
const linkProblem = (file: string, text: string, target: string, cache: Map<string, string>) =>
  Effect.gen(function* () {
    const [pathPart = '', anchor] = decodeURI(target).split('#')
    const dest = pathPart === '' ? file : resolve(file, pathPart)
    if (!(yield* exists(dest))) return `broken link ${target}`
    if (!anchor || (yield* (yield* FileSystem.FileSystem).stat(dest)).type !== 'File') return
    let body = dest === file ? text : cache.get(dest)
    if (body === undefined) {
      body = yield* read(dest)
      cache.set(dest, body)
    }
    if (/\.mdx?$/.test(dest))
      return anchors(body).has(anchor.toLowerCase())
        ? undefined
        : `missing anchor #${anchor} in ${rel(dest)}`
    return lineAnchorOk(anchor, body) ? undefined : `missing line #${anchor} in ${rel(dest)}`
  })

// Every link problem in one Markdown text that lives at absolute path file.
export const checkText = (file: string, text: string, cache = new Map<string, string>()) =>
  Effect.gen(function* () {
    const out: string[] = []
    for (const { line, target } of links(text)) {
      if (isExternal(target)) continue
      const problem = yield* linkProblem(file, text, target, cache)
      if (problem) out.push(`${rel(file)}:${line}: ${problem}`)
    }
    return out
  })

// Skipped: vendored, generated, and benchmark output folders.
const SKIP =
  /(^|\/)(node_modules|dist|vendor)\/|^bench\/(results|recordings)\/|^site\/src\/content\//

const checkFile = (
  file: string,
  paths: ReadonlySet<string>,
  fix: boolean,
  cache: Map<string, string>,
) =>
  Effect.gen(function* () {
    const text = yield* read(file)
    const bare = barePaths(rel(file), text, paths)
    if (fix && bare.hits.length > 0)
      yield* (yield* FileSystem.FileSystem).writeFileString(file, bare.fixed)
    const found = yield* checkText(file, fix ? bare.fixed : text, cache)
    const shown = fix ? [] : bare.hits
    return [
      ...found,
      ...shown.map((h) => `${rel(file)}:${h.line} bare path ${h.path} -> [${h.path}](${h.link})`),
    ]
  })

if (import.meta.main)
  run(
    Effect.gen(function* () {
      const all = yield* tracked()
      const md = Bun.argv.includes('--repo')
        ? (yield* tracked('*.md', '*.mdx')).filter((f) => !SKIP.test(f)).map((f) => repoRoot + f)
        : (yield* files(pluginDir)).filter((f) => f.endsWith('.md'))
      const paths = pathSet(all)
      const fix = Bun.argv.includes('--fix')
      const cache = new Map<string, string>() // one read per link target per run
      return (yield* Effect.forEach(md, (f) => checkFile(f, paths, fix, cache), {
        concurrency: 8,
      })).flat()
    }),
  )
