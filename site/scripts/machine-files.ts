// Runs after `astro build`: writes every machine file into dist/ from its one
// source, so nothing here is copied by hand. Twins come from src/content, the
// same Markdown each page renders; server.json comes from the repo root.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem, Schema } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { SLUGS as PAGE_SLUGS } from '../astro.config.ts'

const SITE = new URL('../', import.meta.url).pathname
const DIST = `${SITE}dist/`
const ORIGIN = 'https://webular.dev'
const INDEX_LINE = `> Docs index for agents: ${ORIGIN}/llms.txt`
// The order of /llms.txt; index is the home page twin, 404 has none.
const SLUGS = PAGE_SLUGS.filter((slug) => slug !== 'index' && slug !== '404')

// The agents twin lives at agents/index.md: /agents.md would clash with the
// served /AGENTS.md on a case-blind disk.
const twinPath = (slug: string) => (slug === 'agents' ? 'agents/index.md' : `${slug}.md`)

const Server = Schema.fromJsonString(
  Schema.Struct({
    name: Schema.String,
    description: Schema.String,
    version: Schema.String,
    repository: Schema.Struct({ url: Schema.String, source: Schema.String }),
  }),
)

const twins = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const llms = yield* fs.readFileString(`${SITE}public/llms.txt`)
  const pages = yield* Effect.forEach(
    SLUGS,
    (slug) =>
      Effect.map(
        fs.readFileString(`${SITE}src/content/${slug}.md`),
        (body) => [slug, body] as const,
      ),
    { concurrency: 4 },
  )
  const all = [['index', llms] as const, ...pages]
  yield* fs.makeDirectory(`${DIST}agents`, { recursive: true })
  yield* Effect.forEach(
    all,
    ([slug, body]) => fs.writeFileString(`${DIST}${twinPath(slug)}`, `${INDEX_LINE}\n\n${body}`),
    { concurrency: 4, discard: true },
  )
  const full = all.map(([slug, body]) => `# ${ORIGIN}/${twinPath(slug)}\n\n${body}`).join('\n')
  yield* fs.writeFileString(`${DIST}llms-full.txt`, full)
  return all.map(([slug]) => slug)
})

const sitemap = (slugs: ReadonlyArray<string>, day: string) => {
  const urls = slugs.flatMap((slug) => [slug === 'index' ? '/' : `/${slug}`, `/${twinPath(slug)}`])
  const rows = urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${day}</lastmod></url>`)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...rows,
    '</urlset>',
    '',
  ].join('\n')
}

// RFC 9116 requires Expires: the build commit date plus 365 days.
const securityTxt = (date: Date) =>
  [
    'Contact: https://github.com/srinitude/webular/security/advisories/new',
    'Policy: https://github.com/srinitude/webular/blob/main/SECURITY.md',
    `Canonical: ${ORIGIN}/.well-known/security.txt`,
    'Preferred-Languages: en',
    `Expires: ${new Date(date.getTime() + 365 * 86_400_000).toISOString()}`,
    '',
  ].join('\n')

const serverFiles = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const serverText = yield* fs.readFileString(`${SITE}../server.json`)
  const toolsText = yield* fs.readFileString(`${SITE}src/generated/tools.json`)
  yield* Schema.decodeUnknownEffect(Server)(serverText)
  yield* fs.writeFileString(`${DIST}server.json`, serverText)
  yield* fs.writeFileString(`${DIST}tools.json`, toolsText)
  yield* fs.makeDirectory(`${DIST}.well-known`, { recursive: true })
})

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const log = yield* runProc(['git', 'log', '-1', '--format=%cI'], { timeoutMs: 10_000, cwd: SITE })
  const date = new Date(log.stdout.trim())
  const slugs = yield* twins
  yield* serverFiles
  yield* fs.copyFile(`${SITE}scripts/agents.txt`, `${DIST}AGENTS.md`)
  yield* fs.writeFileString(`${DIST}sitemap.xml`, sitemap(slugs, date.toISOString().slice(0, 10)))
  yield* fs.writeFileString(`${DIST}.well-known/security.txt`, securityTxt(date))
  yield* Console.log(`machine files: ${slugs.length} twins, llms-full.txt, sitemap`)
})

program.pipe(
  Effect.tapError((e) => Console.error(`site machine files failed: ${String(e)}`)),
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
)
