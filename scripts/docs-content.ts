// mise run docs:build writes one file per webular.dev/docs page, with its footer,
// from docs/site/**, a MAPPED repo file, or the command list. --publish adds the
// export and llms.txt, llms-full.txt, .md twins, and sitemap.xml under /docs.
import { BunRuntime } from '@effect/platform-bun'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Effect, FileSystem, Option } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { commandPages, ROOT } from './docs-commands.ts'
import { copyExport } from './docs-inline.ts'

const SITE = `${ROOT}docs/site/`
const OUT = `${ROOT}site-docs/content/docs/`
const DIST = `${ROOT}site/dist/docs/`
const REPO = 'https://github.com/srinitude/webular'
const BLOB = `${REPO}/blob/main/`
const ORIGIN = 'https://webular.dev/docs'
const SKIP = new Set(['AGENTS.md', 'CLAUDE.md'])

// Pages the IA renders from an existing repo file: slug -> source path.
export const MAPPED: Record<string, string> = {
  'agents/contract': 'docs/agent-contract.md',
  'benchmarks/index': 'docs/benchmarks.md',
  'benchmarks/peers': 'docs/benchmarks-peers.md',
  'benchmarks/method': 'docs/benchmarks-method.md',
  'benchmarks/guide': 'docs/benchmarks-guide.md',
  changelog: 'CHANGELOG.md',
}

// Sidebar order from the IA (sidebar_order in design/webular-docs/ia.json; its "Get started" group shows as "First run").
const ROOT_PAGES = [
  '---First run---',
  ...['index', 'install', 'quickstart', 'concepts', 'jev'],
  ...['---Guides---', 'guides', '---Agents---', 'agents', '---Reference---', 'reference'],
  ...['---Benchmarks---', 'benchmarks', 'compare', '---Project---'],
  ...['troubleshooting', 'changelog', 'security', 'contributing', 'support', 'glossary'],
]
const GUIDES = ['search-the-web', 'read-pages', 'answer-and-research', 'extract-and-parse']
const META: Record<string, { title?: string; pages: string[] }> = {
  '': { pages: ROOT_PAGES },
  guides: { title: 'Guides', pages: [...GUIDES, 'watch-and-feeds', 'browser-mode', 'recipes'] },
  agents: { title: 'Use from an agent', pages: ['index', 'contract', 'llms-txt'] },
  reference: {
    title: 'Reference',
    pages: ['cli', 'commands', 'exit-codes', 'environment', 'safety', 'reliability'],
  },
  benchmarks: { title: 'Benchmark results', pages: ['index', 'peers', 'method', 'guide'] },
}

// A repo-relative link in a mapped file: a mapped sibling becomes /<slug>,
// anything else points at GitHub.
const SLUG_OF = new Map(Object.entries(MAPPED).map(([slug, src]) => [src, slug]))
export const pagePath = (slug: string): string => `/${slug.replace(/(^|\/)?index$/, '')}`

export const rewrite = (body: string, source: string): string =>
  body.replace(/\]\(([^)\s]+)\)/g, (whole, href: string) => {
    if (/^[a-z]+:|^#|^\//.test(href)) return whole
    const [path = '', hash = ''] = href.split('#')
    const target = new URL(path, `${BLOB}${source}`).href.slice(BLOB.length)
    const slug = SLUG_OF.get(target)
    if (slug) return `](${pagePath(slug)}${hash ? `#${hash}` : ''})`
    return `](${BLOB}${target}${hash ? `#${hash}` : ''})`
  })

const mapped = (text: string, source: string): string => {
  const title = text.match(/^# (.+)$/m)?.[1]?.trim() ?? 'Untitled'
  const body = text.replace(/^# .+\n+/m, '')
  return `---\ntitle: ${JSON.stringify(title)}\n---\n\n${rewrite(body, source)}`
}

// The last commit date of one source file; empty when git has none.
// ponytail: one git call per source file; fine for about 60 pages.
const gitDate = (path: string) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const git = ChildProcess.make('git', ['log', '-1', '--format=%cs', '--', path], { cwd: ROOT })
    const lines = yield* spawner.lines(git).pipe(Effect.timeoutOption('10 seconds'), Effect.option)
    const found = Option.flatten(lines)
    return Option.isSome(found) ? (found.value[0] ?? '').trim() : ''
  })

export const footer = (slug: string, source: string, date: string): string => {
  const page = `${ORIGIN}${pagePath(slug)}`
  const issue = `${REPO}/issues/new?title=${encodeURIComponent(`Docs: ${pagePath(slug)}`)}&body=${encodeURIComponent(`Page: ${page}\n\nWhat was missing or wrong?\n`)}`
  const updated = date ? `Last updated ${date} · ` : ''
  return `\n\n---\n\n${updated}[Edit this page on GitHub](${BLOB}${source}) · Was this page helpful? [Tell us in a GitHub issue](${issue})\n`
}

const walk = (
  fs: FileSystem.FileSystem,
  dir: string,
  base = '',
): Effect.Effect<string[], unknown> =>
  Effect.gen(function* () {
    const found: string[] = []
    for (const name of (yield* fs.readDirectory(`${dir}${base}`)).sort()) {
      const rel = `${base}${name}`
      if ((yield* fs.stat(`${dir}${rel}`)).type === 'Directory')
        found.push(...(yield* walk(fs, dir, `${rel}/`)))
      else if (/\.mdx?$/.test(name) && !SKIP.has(name)) found.push(rel)
    }
    return found
  })

const writeOut = (fs: FileSystem.FileSystem, rel: string, text: string) =>
  Effect.gen(function* () {
    yield* fs.makeDirectory(`${OUT}${rel}`.replace(/\/[^/]+$/, ''), { recursive: true })
    yield* fs.writeFileString(`${OUT}${rel}`, text)
  })

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  yield* fs.remove(OUT, { recursive: true }).pipe(Effect.orElseSucceed(() => undefined))
  const site = yield* walk(fs, SITE)
  for (const rel of site) {
    const source = `docs/site/${rel}`
    const text = yield* fs.readFileString(`${SITE}${rel}`)
    const slug = rel.replace(/\.mdx?$/, '')
    yield* writeOut(fs, rel, `${text}${footer(slug, source, yield* gitDate(source))}`)
  }
  for (const [slug, source] of Object.entries(MAPPED)) {
    const text = mapped(yield* fs.readFileString(`${ROOT}${source}`), source)
    yield* writeOut(fs, `${slug}.md`, `${text}${footer(slug, source, yield* gitDate(source))}`)
  }
  const names = yield* writeCommands(fs)
  const meta = { ...META, 'reference/commands': { title: 'Commands', pages: names } }
  for (const [dir, value] of Object.entries(meta))
    yield* writeOut(fs, `${dir ? `${dir}/` : ''}meta.json`, `${JSON.stringify(value, null, 2)}\n`)
  yield* Effect.log(
    `docs content: ${site.length + Object.keys(MAPPED).length + names.length} pages`,
  )
})

// The 22 command pages, built from the code; returns their names in order.
function writeCommands(fs: FileSystem.FileSystem) {
  return Effect.gen(function* () {
    const commands = yield* commandPages()
    const date = yield* gitDate('src/cli/commands.ts')
    for (const { name, mdx } of commands) {
      const slug = `reference/commands/${name}`
      yield* writeOut(fs, `${slug}.mdx`, `${mdx}${footer(slug, 'src/cli/commands.ts', date)}`)
    }
    return commands.map((c) => c.name)
  })
}

// The Markdown twin drops the MDX tab wrappers and keeps every line inside them.
export const twin = (text: string): string =>
  text.replace(/^[ \t]*<\/?Tabs?\b[^>]*>[ \t]*\n?/gm, '').replace(/\n{3,}/g, '\n\n')

const field = (text: string, key: string): string =>
  (text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '').replace(/^["']|["']$/g, '')

const entry = (text: string, path: string) => {
  const date = text.match(/Last updated (\d{4}-\d{2}-\d{2})/)?.[1]
  return {
    index: `- [${field(text, 'title')}](${ORIGIN}${path === '/' ? '' : `${path}.md`}): ${field(text, 'description')}`,
    url: `  <url><loc>${ORIGIN}${path === '/' ? '/' : `${path}/`}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`,
  }
}

// --publish copies the export (scripts moved out), then writes the machine files beside it.
const publish = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  yield* copyExport(fs, `${ROOT}site-docs/out`, DIST)
  // The export owns /docs: drop the Astro page, which would answer /docs ahead of docs/index.html.
  yield* fs.remove(`${ROOT}site/dist/docs.html`, { force: true })
  const index: string[] = []
  const full: string[] = []
  const urls: string[] = []
  for (const rel of yield* walk(fs, OUT)) {
    const text = yield* fs.readFileString(`${OUT}${rel}`)
    const path = pagePath(rel.replace(/\.mdx?$/, ''))
    const md = twin(text)
    if (path !== '/') yield* fs.writeFileString(`${DIST}${path.slice(1)}.md`, md)
    const row = entry(text, path)
    index.push(row.index)
    urls.push(row.url)
    full.push(md)
  }
  const intro = `> Search, scrape, crawl, and answer with sources, from your own machine. Add .md to any page address for its Markdown copy, or read every page in ${ORIGIN}/llms-full.txt.`
  yield* fs.writeFileString(
    `${DIST}llms.txt`,
    `# webular docs\n\n${intro}\n\n## Pages\n\n${index.join('\n')}\n`,
  )
  yield* fs.writeFileString(`${DIST}llms-full.txt`, full.join('\n\n'))
  yield* fs.writeFileString(
    `${DIST}sitemap.xml`,
    `${SITEMAP_HEAD}\n${urls.join('\n')}\n</urlset>\n`,
  )
  yield* Effect.log(`docs published: ${urls.length} pages with .md twins, llms files, sitemap`)
})

const SITEMAP_HEAD =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'

if (import.meta.main)
  (Bun.argv.includes('--publish') ? publish : program).pipe(
    Effect.provide(BunServices.layer),
    BunRuntime.runMain,
  )
