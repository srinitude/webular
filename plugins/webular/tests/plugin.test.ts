// Outcome evals: the manifest, and every skill against agentskills.io and best practices.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'

const root = fileURLToPath(new URL('..', import.meta.url))
const hostWords = /\bClaude\b|AskUserQuestion|\.claude\/|\bBash tool\b|\bRead tool\b|CLAUDE_/
const frontKeys = ['name', 'description', 'compatibility', 'metadata']
const questionOrder = ['Intent', 'Outcome', 'Criteria', 'Proof', 'Boundaries', 'Method']
const nativeAsk = "the host's native question tool, or a plain chat question when none exists"

// The one file-system helper: every read goes through it with the Bun layer.
const files = <A, E>(use: (fs: FileSystem.FileSystem) => Effect.Effect<A, E>) =>
  FileSystem.FileSystem.pipe(Effect.flatMap(use), Effect.provide(BunServices.layer))

const verify =
  <A>(check: (a: A) => void) =>
  <E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.flatMap(self, (a) => Effect.sync(() => check(a)))
const Manifest = Schema.Struct({ $schema: Schema.String, name: Schema.String })
const Evals = Schema.Struct({
  skill_name: Schema.String,
  evals: Schema.Array(Schema.Struct({ id: Schema.String, prompt: Schema.String })),
})
type Skill = { name: string; body: string; front: string; rest: string; texts: Map<string, string> }

// ponytail: a path with an extension and no leading dot is a file; use fs.stat if not.
const isFile = (path: string) => /(^|\/)[^./][^/]*\.\w+$/.test(path)

// AGENTS.md and CLAUDE.md guide agents in the repo and are not skill content.
const isGuide = (path: string) => /(^|\/)(AGENTS|CLAUDE)\.md$/.test(path)

const readTexts = (fs: FileSystem.FileSystem, dir: string) =>
  fs.readDirectory(dir, { recursive: true }).pipe(
    Effect.flatMap((paths) =>
      Effect.forEach(
        paths
          .map((path) => path.replaceAll('\\', '/'))
          .filter((path) => isFile(path) && !isGuide(path)),
        (path) =>
          fs.readFileString(`${dir}/${path}`).pipe(Effect.map((text) => [path, text] as const)),
        { concurrency: 4 },
      ),
    ),
    Effect.map((entries) => new Map(entries)),
  )

const loadSkill = (name: string) =>
  files((fs) => readTexts(fs, `${root}skills/${name}`)).pipe(
    Effect.map((texts): Skill => {
      const body = texts.get('SKILL.md') ?? ''
      const [, front = '', rest = ''] = body.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? []
      return { name, body, front, rest, texts }
    }),
  )

// skills/ also holds AGENTS.md and CLAUDE.md; each skill is a folder.
const skillNames = files((fs) =>
  fs
    .readDirectory(`${root}skills`)
    .pipe(
      Effect.flatMap((names) =>
        Effect.filter(names, (name) =>
          fs.stat(`${root}skills/${name}`).pipe(Effect.map((info) => info.type === 'Directory')),
        ),
      ),
    ),
)

const eachSkill = (check: (skill: Skill) => void) =>
  Effect.runPromise(
    skillNames.pipe(
      Effect.flatMap((names) => Effect.forEach(names, loadSkill, { concurrency: 4 })),
      verify((skills) => {
        expect(skills.length).toBeGreaterThan(1)
        for (const skill of skills) check(skill)
      }),
    ),
  )

const anchor = (h: string) =>
  `#${h
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ /g, '-')}`

const headings = (rest: string) => [...rest.matchAll(/^## (.+)$/gm)].map((m) => m[1] ?? '')
const section = (rest: string, heading: string) =>
  rest.split(/^## /m).find((part) => part.startsWith(`${heading}\n`)) ?? ''

const checkSpec = ({ name, body, front }: Skill) => {
  const description = front.match(/^description: (.*)$/m)?.[1] ?? ''
  expect(front).toMatch(new RegExp(`^name: ${name}$`, 'm'))
  expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  expect(name.length).toBeLessThanOrEqual(64)
  expect(description.length).toBeGreaterThan(20)
  expect(description.length).toBeLessThanOrEqual(1024)
  expect(description).toMatch(/^[A-Z][a-z]+s\b/)
  expect(description).not.toMatch(/\b(I|you|your|we)\b/i)
  expect(description).toMatch(/Use when/)
  expect(body.split('\n').length).toBeLessThan(500)
}

const checkReference = (body: string) => {
  const [title, , header] = body.split('\n')
  const anchors = headings(body).map(anchor)
  const links = [...body.matchAll(/\]\((#[^)]+)\)/g)].map((m) => m[1] ?? '')
  expect(title).toMatch(/^# /)
  expect(header).toBe('| Section | Use when | Do not use when | Related |')
  expect(links.length).toBeGreaterThan(0)
  for (const link of links) expect(anchors).toContain(link)
}

test('plugin.json names the plugin and the spec schema', () =>
  Effect.runPromise(
    files((fs) => fs.readFileString(`${root}plugin.json`)).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(Manifest))),
      verify((manifest) => {
        expect(manifest.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json')
        expect(manifest.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      }),
    ),
  ))

test('every skill meets the agentskills.io name and description rules', () => eachSkill(checkSpec))

test('every skill lists frontmatter keys as name, description, compatibility, metadata', () =>
  eachSkill(({ front }) => {
    expect([...front.matchAll(/^([a-z-]+):/gm)].map((m) => m[1])).toEqual(frontKeys)
    for (const meta of front.match(/^ .*$/gm) ?? []) expect(meta).toMatch(/^ {2}[a-z-]+: "[^"]*"$/)
  }))

test('every skill body opens with the why, right under its title', () =>
  eachSkill(({ rest }) => expect(rest.trimStart()).toMatch(/^# [^\n]+\n\n## Why\n\n\S/)))

test('every skill ends with a "Done when" checklist', () =>
  eachSkill(({ rest }) => {
    const lines = section(rest, 'Done when').split('\n').slice(1).filter(Boolean)
    expect(headings(rest).at(-1)).toBe('Done when')
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) expect(line).toMatch(/^- \[ \] \S/)
  }))

test('every file in a skill folder is linked from SKILL.md, one level deep', () =>
  eachSkill(({ body, texts }) => {
    const links = [...body.matchAll(/\]\(([^)#]+)\)/g)].map((m) => m[1] ?? '')
    const shipped = [...texts.keys()].filter((path) => path !== 'SKILL.md')
    for (const path of shipped) expect(links).toContain(path)
    for (const link of links) expect(shipped).toContain(link)
  }))

test('every skill file stays host-agnostic', () =>
  eachSkill(({ texts }) => {
    for (const [path, text] of texts)
      expect(`${path}: ${hostWords.test(text)}`).toBe(`${path}: false`)
  }))

test('every skill ships at least three evals for its own name', () =>
  eachSkill(({ name, texts }) => {
    const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Evals))
    const evals = decode(texts.get('evals/evals.json'))
    expect(evals.skill_name).toBe(name)
    expect(evals.evals.length).toBeGreaterThanOrEqual(3)
  }))

test('every reference file opens with a table of contents whose links resolve', () =>
  eachSkill(({ texts }) => {
    for (const [path, text] of texts) if (path.startsWith('references/')) checkReference(text)
  }))

test('the interview skill asks one question at a time, outcome before method', () =>
  eachSkill(({ name, rest }) => {
    if (name !== 'webular-interview') return
    const asked = [...section(rest, 'Question order').matchAll(/^\d+\. \*\*(\w+)/gm)].map(
      (m) => m[1],
    )
    expect(asked).toEqual(questionOrder)
    expect(rest).toContain(nativeAsk)
    expect(rest).toMatch(/one question at a time/i)
    expect(rest).toMatch(/read the working folder before the first question/i)
    expect(headings(rest)).toContain('Decisions summary')
  }))

// The model-matrix smoke saw Haiku and Sonnet stop at "the webular server is
// still connecting" after loading this skill; the next turn has the tools.
test('the research skill says to wait out a connecting server before the tool table', () =>
  eachSkill(({ name, rest }) => {
    if (name !== 'webular-research') return
    const order = headings(rest)
    expect(order.indexOf('When the tools are not there yet')).toBe(order.indexOf('Why') + 1)
    const wait = section(rest, 'When the tools are not there yet')
    expect(wait).toMatch(/still connecting/)
    expect(wait).toMatch(/Do not stop there/)
    expect(wait).toMatch(
      /^1\. List the webular server's MCP resources once\. If you have no tool for that, load this skill once more\./m,
    )
  }))
