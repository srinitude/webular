// Guard: the AGENTS.md tree follows the meta-rules in the root AGENTS.md
// ("Nested AGENTS.md files"): coverage, shape, size, no line repeated from a
// parent, real mise tasks and paths, https citations, and timeless wording.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { findings } from '../../plugins/webular/scripts/check-timeless.ts'
import { runProc } from '../../src/core/proc.ts'
import { exists, read } from '../_support/repo-files.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

// Generated or recorded folders, the Markdown chain ledger, and agent worktrees need no AGENTS.md.
const EXEMPT = [
  'bench/recordings',
  'bench/results',
  // Generated or recorded fixture data: the fixture server serves these trees
  // by path, so an extra file there would change crawl and scrape results.
  'bench/fixtures/pages',
  'bench/fixtures/sites',
  'tests/bench/fixtures/recordings',
  'plugins/webular/dist',
  '.claude/worktrees',
  '.markdown-chain',
]
const HEADINGS = ['## What lives here', '## Rules', '## Checks', '## Children']
const CAP = { root: { lines: 150, bytes: 12_288 }, nested: { lines: 60, bytes: 4_096 } }
const CHAIN_BYTES = 32_768

interface Doc {
  dir: string
  text: string
}

const isExempt = (dir: string) => EXEMPT.some((e) => dir === e || dir.startsWith(`${e}/`))

const dirsOf = (files: ReadonlyArray<string>) => {
  const dirs = new Set<string>()
  for (const file of files) {
    const parts = file.split('/')
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
  }
  return [...dirs].filter((d) => !isExempt(d)).sort()
}

const trackedDirs = runProc(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], {
  timeoutMs: 10_000,
  cwd: ROOT,
}).pipe(Effect.map(({ stdout }) => ['', ...dirsOf(stdout.split('\n').filter(Boolean))]))

const docPath = (dir: string) => (dir === '' ? 'AGENTS.md' : `${dir}/AGENTS.md`)

const presence = Effect.gen(function* () {
  const dirs = yield* trackedDirs
  const present = yield* Effect.forEach(dirs, (d) => exists(docPath(d)), { concurrency: 8 })
  return { dirs, present }
})

const loadDocs = Effect.gen(function* () {
  const { dirs, present } = yield* presence
  const kept = dirs.filter((_, i) => present[i])
  const texts = yield* Effect.forEach(kept, (d) => read(docPath(d)), { concurrency: 8 })
  return kept.map((dir, i): Doc => ({ dir, text: texts[i] ?? '' }))
})

const ancestors = (dir: string, docs: ReadonlyArray<Doc>) =>
  docs.filter((d) => d.dir !== dir && (d.dir === '' || dir.startsWith(`${d.dir}/`)))

const shapeProblems = ({ dir, text }: Doc) => {
  const lines = text.split('\n')
  const out: string[] = []
  if (lines[0] !== `# ${docPath(dir)}`) out.push(`line 1 is not "# ${docPath(dir)}"`)
  if (!/\]\((\.\.\/)+AGENTS\.md\)/.test(lines[2] ?? '')) out.push('line 3 does not link the parent')
  const order = lines.filter((l) => l.startsWith('## ')).map((h) => HEADINGS.indexOf(h))
  if (order.some((n, i) => n < 0 || (i > 0 && n <= (order[i - 1] ?? -1)))) {
    out.push(`headings must be a subset of ${HEADINGS.join(', ')}, in order`)
  }
  return out.map((p) => `${docPath(dir)}: ${p}`)
}

const bytes = (text: string) => new TextEncoder().encode(text).length

const sizeProblems = (doc: Doc, docs: ReadonlyArray<Doc>) => {
  const cap = doc.dir === '' ? CAP.root : CAP.nested
  const lines = doc.text.split('\n').length - 1
  const chain = [...ancestors(doc.dir, docs), doc].reduce((n, d) => n + bytes(d.text), 0)
  return [
    lines > cap.lines ? `${lines} lines > ${cap.lines}` : '',
    bytes(doc.text) > cap.bytes ? `${bytes(doc.text)} bytes > ${cap.bytes}` : '',
    chain > CHAIN_BYTES ? `chain of ${chain} bytes > ${CHAIN_BYTES}` : '',
  ]
    .filter(Boolean)
    .map((p) => `${docPath(doc.dir)}: ${p}`)
}

const meaningful = (line: string) =>
  line.trim().length >= 25 && !line.startsWith('#') && !line.trim().startsWith('```')

const repeatedLines = (doc: Doc, docs: ReadonlyArray<Doc>) => {
  const seen = new Set(
    ancestors(doc.dir, docs).flatMap((d) => d.text.split('\n').map((l) => l.trim())),
  )
  return doc.text
    .split('\n')
    .filter((l) => meaningful(l) && seen.has(l.trim()))
    .map((l) => `${docPath(doc.dir)}: repeats a parent line: ${l.trim()}`)
}

const taskNames = (toml: string) =>
  new Set([...toml.matchAll(/^\[tasks\.(?:"([^"]+)"|([\w-]+))\]/gm)].map((m) => m[1] ?? m[2]))

const missingTasks = (doc: Doc, tasks: Set<string | undefined>) =>
  [...doc.text.matchAll(/mise run ([\w:-]+)/g)]
    .map((m) => m[1] ?? '')
    .filter((name) => !name.endsWith(':') && !tasks.has(name))
    .map((name) => `${docPath(doc.dir)}: no mise task "${name}"`)

// A code span or relative link that names a repo path: a folder ending in `/`
// or a file with an extension. Placeholders, URLs, absolute paths, build
// output under dist/, protocol names, and package@tag citations are not paths.
const pathsIn = (text: string) => [
  ...[...text.matchAll(/`([^`\s]+\/[^`\s]*)`/g)].map((m) => m[1] ?? ''),
  ...[...text.matchAll(/\]\((?!https?:)([^)#\s]+)/g)].map((m) => m[1] ?? ''),
]
const isPath = (p: string) =>
  /(\/|\.\w+)$/.test(p) && !/^(\/|https?:|\.\/?$|dist\/)|\/dist\/|[<>*{}$@]/.test(p)

const missingPaths = (doc: Doc) =>
  Effect.gen(function* () {
    const paths = pathsIn(doc.text).filter(isPath)
    const base = doc.dir === '' ? '' : `${doc.dir}/`
    const found = yield* Effect.forEach(
      paths,
      (p) => Effect.zipWith(exists(p), exists(`${base}${p}`), (a, b) => a || b),
      { concurrency: 8 },
    )
    return paths.filter((_, i) => !found[i]).map((p) => `${docPath(doc.dir)}: no path ${p}`)
  })

const badCitations = (doc: Doc) =>
  [...doc.text.matchAll(/\[([^\]]*)\]\((https?:[^)]*)\)/g)]
    .filter((m) => !(m[2] ?? '').startsWith('https://') || (m[1] ?? '').trim() === '')
    .map((m) => `${docPath(doc.dir)}: citation ${m[0]} needs link text and an https URL`)

const docProblems = (doc: Doc, docs: ReadonlyArray<Doc>) => [
  ...(doc.dir === '' ? [] : shapeProblems(doc)),
  ...sizeProblems(doc, docs),
  ...repeatedLines(doc, docs),
  ...badCitations(doc),
  // A citation's pinned tag and the folder name in line 1 are data, not time talk.
  ...findings(doc.text.replace(/^# .*/, '#').replace(/\[[^\]]*\]\(https:[^)]*\)/g, '[cited]')).map(
    (f) => `${docPath(doc.dir)}:${f.line}: ${f.kind} "${f.word}"`,
  ),
]

describe('AGENTS.md tree', () => {
  test(
    'coverage: every tracked folder has an AGENTS.md',
    eff(
      Effect.map(presence, ({ dirs, present }) =>
        expect(dirs.filter((_, i) => !present[i]).map(docPath)).toEqual([]),
      ),
    ),
    30_000,
  )

  test(
    'shape, size, no repeated parent line, citations, and timeless wording',
    eff(
      Effect.map(loadDocs, (docs) =>
        expect(docs.flatMap((doc) => docProblems(doc, docs))).toEqual([]),
      ),
    ),
    30_000,
  )

  test(
    'every mise task and path named exists',
    eff(
      Effect.gen(function* () {
        const docs = yield* loadDocs
        const tasks = taskNames(yield* read('mise.toml'))
        const paths = yield* Effect.forEach(docs, missingPaths, { concurrency: 8 })
        expect([...docs.flatMap((d) => missingTasks(d, tasks)), ...paths.flat()]).toEqual([])
      }),
    ),
    30_000,
  )

  test('the meta-rule checks catch a bad file', () => {
    const bad: Doc = { dir: 'src', text: '# wrong\n\nno link\n\n## Rules\n## Checks\n## Rules\n' }
    expect(shapeProblems(bad)).toHaveLength(3)
    expect(badCitations({ dir: 'src', text: '[x](http://a.b)' })).toHaveLength(1)
    expect(missingTasks({ dir: '', text: 'mise run nope' }, new Set(['lint']))).toHaveLength(1)
    expect(isPath('rounds/<round-id>/cache')).toBe(false)
  })
})
