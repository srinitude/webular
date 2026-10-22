// README.md and docs/install.md state facts the code owns: command names,
// flags, the MCP tool count, env var names, platform targets, and install
// package names. This test pulls each fact out by pattern (framing text is
// free to change) and checks it against sets derived from src/ and mise.toml.
// Full-coverage lists (a "Command" table, a "Platforms" section) must also
// name every real member. Generated bench blocks are skipped.
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Glob } from 'bun'
import { Effect, FileSystem } from 'effect'
import pkg from '../../package.json' with { type: 'json' }
import { COMMANDS } from '../../src/cli/commands.ts'
import { WINGET_ID } from '../../src/release/winget.ts'
import { mcpToolIds } from '../../src/tools/web.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const all = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m[1] ?? '')
const read = (p: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(join(ROOT, p)))

type Truth = {
  commands: Set<string>
  flags: Set<string>
  tools: number
  env: Set<string>
  platforms: Set<string>
  installs: Map<string, string>
}

const truth = Effect.gen(function* () {
  const files = [...new Glob('src/**/*.ts').scanSync(ROOT)]
  const src = (yield* Effect.forEach(files, read, { concurrency: 16 })).join('\n')
  const dist = yield* read('src/release/distribution.ts')
  // The plugin's own server reads env too (WEBULAR_BIN); only its env reads count.
  const pluginFiles = [...new Glob('plugins/webular/src/**/*.ts').scanSync(ROOT)]
  const plugin = (yield* Effect.forEach(pluginFiles, read, { concurrency: 16 })).join('\n')
  // Env reads: process.env['X'] / env.X, and Effect Config constructors
  // (Config.String('X'), Config.Redacted('X'), ...) or a setting('X') helper.
  const envRead =
    /(?:env\[['"]|env\.|Config\.[A-Z]\w*\(\s*'|\bsetting\(\s*')([A-Z][A-Z0-9_]+)/g
  const flags = [
    ...all(src, /^\s+'?([a-z][a-z0-9-]*)'?: \{ type: '(?:string|boolean)'/gm),
    ...all(src, /(?<![\w-])--([a-z][a-z0-9-]*)/g),
  ]
  const truth: Truth = {
    commands: new Set(Object.keys(COMMANDS)),
    flags: new Set(flags),
    tools: mcpToolIds.length,
    env: new Set([...all(src, envRead), ...all(plugin, envRead)]),
    platforms: new Set(all(yield* read('mise.toml'), /--target=bun-([a-z0-9-]+)/g)),
    installs: new Map([
      ['npm', pkg.name],
      ['bun', pkg.name],
      ['brew', all(dist, /\['(\w+)\.rb', yield\* homebrewFormula/g)[0] ?? ''],
      ['scoop', all(dist, /\['(\w+)\.json', yield\* scoopManifest/g)[0] ?? ''],
      ['winget', WINGET_ID],
    ]),
  }
  return truth
})

const stripBench = (md: string) =>
  md.replace(/<!-- bench:start[^>]*-->[\s\S]*?<!-- bench:end -->/g, '')

// Every line of code the doc shows: fenced block lines and inline spans.
const codeLines = (md: string) => [
  ...all(md, /```[^\n]*\n([\s\S]*?)```/g).flatMap((b) => b.split('\n')),
  ...all(md.replace(/```[\s\S]*?```/g, ''), /`([^`\n]+)`/g),
]

// A line starting with `/` is a chat slash command (Claude Code's
// `/plugin install webular --marketplace ...`): there webular is an argument,
// not the command, so its flags are not webular's.
const invocations = (lines: string[]) =>
  lines
    .filter((l) => !/^\s*\//.test(l))
    .flatMap((l) => all(l, /(?:^|\s)webular(\s.*)$/g)).filter((rest) => rest.trim())

const section = (md: string, heading: RegExp) => {
  const lines = md.split('\n')
  const start = lines.findIndex((l) => /^#+\s/.test(l) && heading.test(l))
  if (start < 0) return undefined
  const end = lines.findIndex((l, i) => i > start && /^#+\s/.test(l))
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n')
}

const commandTable = (md: string) => {
  const rows = md.split('\n')
  const head = rows.findIndex((l) => /^\|\s*Command\s*\|/.test(l))
  if (head < 0) return undefined
  const body = rows.slice(head + 2)
  const stop = body.findIndex((l) => !l.startsWith('|'))
  return body.slice(0, stop < 0 ? undefined : stop).flatMap((l) => all(l, /^\|\s*`([^`]+)`/g))
}

const missing = (what: string, listed: string[], real: Set<string>) =>
  [...real].filter((x) => !listed.includes(x)).map((x) => `${what} list is missing ${x}`)

const INSTALLS: [string, RegExp][] = [
  // The name only: a version tag (`webular@latest`) is not part of it.
  ['npm', /\bnpm (?:i|install) -g ((?:@[\w-]+\/)?[\w-]+)/g],
  ['bun', /\bbun add -g ((?:@[\w-]+\/)?[\w-]+)/g],
  ['brew', /\bbrew install (?:[\w-]+\/[\w-]+\/)?([\w-]+)/g],
  ['scoop', /\bscoop install ([\w-]+)/g],
  ['winget', /\bwinget install ([\w.-]+)/g],
]

const installProblems = (lines: string[], t: Truth) =>
  INSTALLS.flatMap(([kind, re]) =>
    lines
      .flatMap((l) => all(l, re))
      .filter((name) => t.installs.get(kind) !== name)
      .map((name) => `${kind} installs ${name}, but the build names ${t.installs.get(kind)}`),
  )

const PLATFORM = /(?<![\w-])((?:darwin|linux|windows|win32|freebsd|android)-[a-z0-9-]+)/g

// Link targets and bare URLs are addresses, not platform names
// (learn.microsoft.com/.../windows-server/...).
const withoutUrls = (md: string) => md.replace(/\]\([^)\s]*\)|https?:\/\/[^\s)>]+/g, ']')

const ENV_SPAN = /^\$?([A-Z][A-Z0-9]*_[A-Z0-9_]+)(?:=.*)?$/g

// Every fact in one doc that disagrees with the code, as plain sentences.
const docProblems = (raw: string, t: Truth): string[] => {
  const md = stripBench(raw)
  const lines = codeLines(md)
  const calls = invocations(lines)
  const table = commandTable(md)
  const commands = [
    ...calls.flatMap((c) => all(c, /^\s+([a-z][a-z-]*)(?=\s|$)/g)),
    ...(table ?? []),
  ]
  const flags = [...calls, ...lines.filter((l) => l.startsWith('-'))].flatMap((l) =>
    all(l, /(?<![\w-])--([a-z][a-z0-9-]*)/g),
  )
  const counts = all(md, /\b(\d+) (?:MCP )?tools\b/gi).map(Number)
  const env = [...lines.flatMap((l) => all(l, ENV_SPAN)), ...all(md, /\b(WEBULAR_[A-Z0-9_]+)\b/g)]
  const platformList = section(md, /platforms/i)
  const problems = [
    ...commands.filter((c) => !t.commands.has(c)).map((c) => `no command webular ${c}`),
    ...flags.filter((f) => !t.flags.has(f)).map((f) => `no command defines --${f}`),
    ...counts.filter((n) => n !== t.tools).map((n) => `says ${n} MCP tools, server has ${t.tools}`),
    ...env.filter((e) => !t.env.has(e)).map((e) => `src never reads ${e}`),
    ...all(withoutUrls(md), PLATFORM)
      .filter((p) => !t.platforms.has(p))
      .map((p) => `platform ${p} is not built`),
    ...installProblems(lines, t),
    ...(table ? missing('command', table, t.commands) : []),
    ...(platformList ? missing('platform', all(platformList, /`([a-z0-9-]+)`/g), t.platforms) : []),
  ]
  return [...new Set(problems)]
}

const PLANTED: [string, string, string][] = [
  ['fake command', '```bash\nwebular frobnicate https://a.b\n```', 'no command webular frobnicate'],
  [
    'fake flag',
    '```bash\nwebular scrape https://a.b --frobnicate\n```',
    'no command defines --frobnicate',
  ],
  ['wrong tool count', 'The server has 3 MCP tools.', 'says 3 MCP tools, server has '],
  ['fake env var', 'Set `WEBULAR_FROBNICATE=1`.', 'src never reads WEBULAR_FROBNICATE'],
  ['fake platform', 'Also `freebsd-x64`.', 'platform freebsd-x64 is not built'],
  [
    'wrong package',
    '```bash\nnpm i -g webular-cli\n```',
    'npm installs webular-cli, but the build names webular',
  ],
  [
    'short command table',
    '| Command | What |\n|---|---|\n| `scrape` | x |',
    'command list is missing search',
  ],
  ['short platform list', '## Platforms\n\n`darwin-arm64`\n', 'platform list is missing linux-x64'],
]

describe('README and install docs match the code', () => {
  test.each(['README.md', 'docs/install.md'])('%s states only real facts', (doc) =>
    eff(
      Effect.gen(function* () {
        expect(docProblems(yield* read(doc), yield* truth)).toEqual([])
      }),
    )(),
  )

  // Each planted drift is appended to the real README (the table and list
  // drifts stand alone, since the README's own table comes first).
  test.each(PLANTED)('planted %s is caught', (kind, planted, problem) =>
    eff(
      Effect.gen(function* () {
        const base = kind.startsWith('short') ? '' : yield* read('README.md')
        const found = docProblems(`${base}\n${planted}\n`, yield* truth)
        expect(found.some((p) => p.startsWith(problem))).toBe(true)
      }),
    )(),
  )
})
