// Mechanical Markdown checks: line limits, local link targets, #anchors, and an optional reading graph.
// Run: bun check.ts [--manifest manifest.json] <files...>  (JSON on stdout, exit 1 on errors)
import { dirname, resolve } from 'node:path'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem, Schema } from 'effect'

const HARD_LIMIT = 200
const REVIEW_AT = 150

// Reading graph: entrypoints plus declared edges; only "required" edges can form a cycle.
const Edge = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  kind: Schema.Literals(['required', 'navigation']),
})
const Manifest = Schema.Struct({
  entrypoints: Schema.optionalKey(Schema.Array(Schema.String)),
  dependencies: Schema.optionalKey(Schema.Array(Edge)),
})
export type Manifest = typeof Manifest.Type

type Parsed = { lines: number; links: string[]; anchors: Set<string> }
type Result = { errors: string[]; needs_review: string[]; files: { path: string; lines: number }[] }

// GitHub slug rule: lowercase, drop punctuation, spaces to hyphens; repeats get -1, -2.
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}_ -]/gu, '')
    .replaceAll(' ', '-')

const headingSlug = (raw: string) => {
  const title = raw.match(/^ {0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/)?.[1]
  if (title === undefined) return undefined
  // Split on `<` and drop each piece's text up to its first `>`: no `<` survives to rebuild a tag.
  const text = title.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '')
  const parts = text.split('<').map((p, i) => (i ? p.slice(p.indexOf('>') + 1) : p))
  return slug(parts.join(''))
}

// ponytail: line regexes, not an AST; nested parens in URLs and indented code blocks are missed.
const lineParts = (raw: string) => {
  const line = raw.replace(/`[^`]*`/g, '')
  const links = [...line.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)|\b(?:href|src)="([^"]+)"/g)].map(
    (m) => m[1] ?? m[2] ?? '',
  )
  const ids = [...line.matchAll(/\b(?:id|name)="([^"]+)"/g)].map((m) => m[1] ?? '')
  const def = line.match(/^ {0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/)?.[1]
  return { links: def ? [...links, def] : links, ids }
}

const parse = (text: string): Parsed => {
  const out: Parsed = {
    lines: text ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0,
    links: [],
    anchors: new Set(),
  }
  const seen = new Map<string, number>()
  let fence = ''
  for (const raw of text.split('\n')) {
    const mark = raw.match(/^ {0,3}(`{3,}|~{3,})/)?.[1] ?? ''
    if (fence || mark) {
      fence = fence ? (mark[0] === fence[0] && mark.length >= fence.length ? '' : fence) : mark
      continue
    }
    const { links, ids } = lineParts(raw)
    out.links.push(...links)
    for (const id of ids) out.anchors.add(id)
    const base = headingSlug(raw)
    if (base === undefined) continue
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    out.anchors.add(n ? `${base}-${n}` : base)
  }
  return out
}

const decode = (s: string) =>
  Effect.try(() => decodeURIComponent(s)).pipe(Effect.orElseSucceed(() => s))

// Depth-first search over required edges; each back edge is one cycle.
const cycles = (edges: ReadonlyArray<readonly [string, string]>) => {
  const graph = new Map<string, string[]>()
  for (const [a, b] of edges) graph.set(a, [...(graph.get(a) ?? []), b])
  const done = new Set<string>()
  const found: string[][] = []
  const visit = (node: string, path: string[]): void => {
    const at = path.indexOf(node)
    if (at >= 0) return void found.push([...path.slice(at), node])
    if (done.has(node)) return
    for (const next of graph.get(node) ?? []) visit(next, [...path, node])
    done.add(node)
  }
  for (const node of graph.keys()) visit(node, [])
  return found
}

const graphErrors = (files: string[], manifest: Manifest, routes: Map<string, Set<string>>) => {
  const deps = (manifest.dependencies ?? []).map((d) => ({
    ...d,
    from: resolve(d.from),
    to: resolve(d.to),
  }))
  for (const d of deps) routes.set(d.from, (routes.get(d.from) ?? new Set<string>()).add(d.to))
  const errors = cycles(
    deps.filter((d) => d.kind === 'required').map((d) => [d.from, d.to] as const),
  ).map((c) => `Required-read cycle: ${c.join(' -> ')}`)
  const reached = new Set<string>()
  const pending = (manifest.entrypoints ?? []).map((p) => resolve(p))
  for (const node of pending) {
    if (reached.has(node)) continue
    reached.add(node)
    pending.push(...(routes.get(node) ?? []))
  }
  const lost = reached.size ? files.filter((f) => !reached.has(f)) : []
  return [...errors, ...lost.map((f) => `Markdown file is unreachable from entrypoints: ${f}`)]
}

type Ctx = {
  fs: FileSystem.FileSystem
  result: Result
  routes: Map<string, Set<string>>
  cache: Map<string, Parsed | undefined>
}

const read = (c: Ctx, file: string) =>
  c.cache.has(file)
    ? Effect.succeed(c.cache.get(file))
    : c.fs.readFileString(file).pipe(
        Effect.map((text) => parse(text.replaceAll('\r\n', '\n'))),
        Effect.catch((e) =>
          Effect.sync(() => void c.result.errors.push(`Cannot read ${file}: ${e.message}`)),
        ),
        Effect.tap((parsed) => Effect.sync(() => c.cache.set(file, parsed))),
      )

const checkLink = (c: Ctx, file: string, dest: string) =>
  Effect.gen(function* () {
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(dest)) return
    const hash = dest.indexOf('#')
    const local = yield* decode(hash < 0 ? dest : dest.slice(0, hash))
    const fragment = hash < 0 ? '' : yield* decode(dest.slice(hash + 1))
    if (local.startsWith('/'))
      return void c.result.needs_review.push(
        `${file}: site-root link needs a renderer check: ${dest}`,
      )
    const target = local ? resolve(dirname(file), local) : file
    const isMd = target.toLowerCase().endsWith('.md')
    if (isMd) c.routes.set(file, (c.routes.get(file) ?? new Set<string>()).add(target))
    if (!(yield* c.fs.exists(target).pipe(Effect.orElseSucceed(() => false)))) {
      return void c.result.errors.push(`${file}: missing local target ${dest}`)
    }
    if (!fragment) return
    if (!isMd)
      return void c.result.needs_review.push(`${file}: non-Markdown anchor needs review: ${dest}`)
    const parsed = yield* read(c, target)
    if (parsed && !parsed.anchors.has(fragment))
      c.result.errors.push(`${file}: missing heading or HTML anchor ${dest}`)
  })

const checkFile = (c: Ctx, file: string) =>
  Effect.gen(function* () {
    const parsed = yield* read(c, file)
    if (!parsed) return
    const { errors, needs_review, files } = c.result
    files.push({ path: file, lines: parsed.lines })
    if (parsed.lines >= HARD_LIMIT)
      errors.push(`${file}: ${parsed.lines} physical lines; maximum is ${HARD_LIMIT - 1}`)
    else if (parsed.lines >= REVIEW_AT)
      needs_review.push(
        `${file}: ${parsed.lines} lines; check each part earns its place or split it`,
      )
    for (const dest of parsed.links) yield* checkLink(c, file, dest)
  })

export const checkMarkdown = (paths: ReadonlyArray<string>, manifest: Manifest = {}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const c: Ctx = {
      fs,
      result: { errors: [], needs_review: [], files: [] },
      routes: new Map(),
      cache: new Map(),
    }
    const files = paths.map((p) => resolve(p))
    for (const file of files) yield* checkFile(c, file)
    c.result.errors.push(...graphErrors(files, manifest, c.routes))
    return c.result
  })

const main = (args: string[]) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const at = args.indexOf('--manifest')
    const manifestPath = at >= 0 ? args.splice(at, 2)[1] : undefined
    const manifest = manifestPath
      ? yield* fs
          .readFileString(manifestPath)
          .pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(Manifest))))
      : {}
    const result = yield* checkMarkdown(args, manifest)
    yield* Console.log(JSON.stringify(result, null, 2))
    if (result.errors.length) yield* Effect.sync(() => Object.assign(process, { exitCode: 1 }))
  })

if (import.meta.main)
  BunRuntime.runMain(main(process.argv.slice(2)).pipe(Effect.provide(BunServices.layer)))
