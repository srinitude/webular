// Analyzers for the AGENTS.md sync gate (tests/quality/agents-md-sync.test.ts):
// each takes the doc text and the repo facts and returns the drift it finds.
import { Effect } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { read } from './repo-files.ts'
import { ROOT } from './root.ts'

export interface Doc {
  dir: string
  path: string
  text: string
}

const TOOL_PREFIX = /^(BUN|MISE|NODE|GITHUB|CLAUDE)_/
const KEY_VAR = /\b[A-Z][A-Z0-9]*_(?:API_)?(?:KEY|TOKEN|SECRET)\b/g
const JEV_KEY_VAR = 'TYPESAFE_API_KEY'
// Names that belong to a package the docs describe, not to this repo's code.
// ponytail: a fixed list; a doc line that cites its source would not need it.
const EXTERNAL = new Set([
  // @modelcontextprotocol/sdk and server
  'localhostHostValidation',
  'localhostOriginValidation',
  'ProtocolError',
  'ProtocolErrorCode',
  'SdkError',
  'McpError',
  'ErrorCode',
  // ai and @ai-sdk/anthropic
  'AnthropicMessagesModelId',
  'LanguageModelV1',
  // @xstate/graph
  'stopWhen',
  'getPathsFromEvents',
  // linkedom
  'documentURI',
])
const BUILTIN_COMMANDS = new Set(['help', 'version', 'mcp'])

export const spans = (text: string) =>
  [...text.replace(/^```[\s\S]*?^```/gm, '').matchAll(/`([^`\n]+)`/g)].map((m) => m[1] ?? '')

const prose = (text: string) => text.replace(/^```[\s\S]*?^```/gm, '').split('\n')

// Spans on lines that cite an external source describe that package, not this repo.
const ownSpans = (text: string) =>
  prose(text)
    .filter((l) => !l.includes('](') && !l.includes('Source:'))
    .flatMap(spans)

const isSymbol = (s: string) =>
  /^[A-Za-z_$][\w$]*\(\)$/.test(s) || /^(?:[a-z]+[A-Z]|[A-Z][a-z]+[A-Z])[A-Za-z0-9]*$/.test(s)

// Every name a doc claims exists in code: env vars, flags, and exported symbols.
export const claims = (text: string) => {
  const own = ownSpans(text)
  return {
    env: own.filter((s) => /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(s) && !TOOL_PREFIX.test(s)),
    flags: own.flatMap((s) => (/^--[a-z][\w-]*/.exec(s) ?? []).slice(0, 1)),
    symbols: own.filter(isSymbol).map((s) => s.replace('()', '')),
    commands: own.flatMap((s) => (/^webular ([a-z][\w-]*)/.exec(s) ?? []).slice(1, 2)),
  }
}

// Every identifier and flag in tracked source, config, and tests (not Markdown or recordings).
export const present = () =>
  runProc(
    [
      'git',
      'grep',
      '-ohE',
      '[A-Za-z_][A-Za-z0-9_]{3,}|--[a-z][a-z-]+',
      '--',
      'src',
      'scripts',
      'bin',
      'plugins',
      'tests',
      'bench',
      '.github',
      'mise.toml',
      'package.json',
      ':(exclude)*.md',
      ':(exclude)plugins/webular/dist',
      ':(exclude)tests/jev/replay',
      ':(exclude)tests/models',
      ':(exclude)tests/fixtures',
      ':(exclude)bench/fixtures',
      ':(exclude)bench/results',
      ':(exclude)bench/recordings',
    ],
    { timeoutMs: 30_000, cwd: ROOT },
  ).pipe(Effect.map(({ stdout }) => new Set(stdout.split('\n'))))

export const codeDrift = (docs: ReadonlyArray<Doc>, commands: ReadonlySet<string>) =>
  Effect.gen(function* () {
    const found = docs.map((d) => ({ d, c: claims(d.text) }))
    const seen = yield* present()
    return found.flatMap(({ d, c }) => [
      ...[...c.env, ...c.flags, ...c.symbols]
        .filter((n) => !seen.has(n) && !EXTERNAL.has(n))
        .map((n) => `${d.path}: \`${n}\` is not in the code`),
      ...c.commands
        .filter((n) => !commands.has(n) && !BUILTIN_COMMANDS.has(n))
        .map((n) => `${d.path}: no command "webular ${n}"`),
    ])
  })

// Only the Jev key may be named as a usable key; no other search or provider key.
export const keyDrift = ({ path, text }: Doc) => [
  ...(text.match(KEY_VAR) ?? [])
    .filter((v) => v !== JEV_KEY_VAR)
    .map((v) => `${path}: names a non-Jev key ${v}`),
  ...(/\bbrave\b/i.test(text) ? [`${path}: mentions Brave`] : []),
  ...(/\bprovider keys?\b/i.test(text) ? [`${path}: mentions provider keys`] : []),
]

// A backticked file name with an extension must be a tracked file somewhere.
export const missingFileNames = ({ path, text }: Doc, basenames: ReadonlySet<string>) =>
  ownSpans(text)
    .filter((s) => /^[\w.-]+\.(?:ts|md|json|jsonl|toml|yml|yaml|sh|txt)$/.test(s))
    .filter((s) => !basenames.has(s))
    .map((s) => `${path}: no tracked file named ${s}`)

// Direct files and child folders of a doc's folder that the doc does not name
// (a child folder is named by `name/`, a file by its base name).
// Recorded or generated folders hold files named by hash or run id, not by hand.
const RECORDED = /^tests\/(?:jev\/replay|models\/fixtures)(?:\/|$)/

export const unnamed = ({ dir, text }: Doc, tracked: ReadonlyArray<string>) => {
  if (RECORDED.test(dir)) return []
  const base = dir === '' ? '' : `${dir}/`
  const entries = tracked
    .filter((f) => f.startsWith(base))
    .map((f) => f.slice(base.length).split('/'))
    .map((p) => (p.length === 1 ? (p[0] ?? '') : `${p[0]}/`))
  return [...new Set(entries)].filter(
    (n) => !/^(?:AGENTS|CLAUDE)\.md$/.test(n) && !text.includes(n),
  )
}

export const readDocs = (paths: ReadonlyArray<string>) =>
  Effect.forEach(
    paths,
    (path) =>
      Effect.map(
        read(path),
        (text): Doc => ({ path, text, dir: path.slice(0, -'AGENTS.md'.length - 1) }),
      ),
    { concurrency: 8 },
  )
