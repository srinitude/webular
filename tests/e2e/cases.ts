// Every e2e case as data. `{origin}` is the shared fixture server; `{tmp}` is
// the run's private temp folder. Each case states its exit code, whether
// stdout is one JSON object, the stderr text on errors, a ceiling on output
// characters (about 4 per token), and a latency budget. Ceilings and budgets
// are a measured macOS run times about 3, rounded up, so slower CI runners
// still pass.
import type { CommandName } from '../../src/cli/commands.ts'

export type Via = 'bundle' | 'bin' | 'exe'

export interface CliCase {
  name: string
  cmd: CommandName
  args: string[]
  via?: Via
  code?: number
  json?: boolean
  err?: string
  maxChars: number
  maxMs: number
}

const ok = (name: string, cmd: CommandName, args: string[], maxChars = 6000, maxMs = 8000) => ({
  name,
  cmd,
  args: [...args, '--json'],
  json: true,
  maxChars,
  maxMs,
})

const usage = (name: string, cmd: CommandName, args: string[], err: string): CliCase => ({
  name,
  cmd,
  args,
  code: 2,
  err,
  maxChars: 400,
  maxMs: 3000,
})

export const CLI_CASES: CliCase[] = [
  ok('search a source', 'search', ['--query', 'bun', '--source', 'hackernews', '--limit', '2']),
  ok('search short flag', 'search', ['-q', 'bun', '--source', 'hackernews']),
  usage('search unknown source', 'search', ['bun', '--source', 'nope'], '--source'),
  ok('scrape a page', 'scrape', ['--url', '{origin}/a', '--archive']),
  usage('scrape needs a url', 'scrape', [], 'url'),
  usage('scrape bad renderer', 'scrape', ['{origin}/a', '--render', 'x'], '--render'),
  ok('crawl a site', 'crawl', [
    '--url',
    '{origin}/',
    '--limit',
    '4',
    '--depth',
    '2',
    '--concurrency',
    '2',
  ]),
  ok('map a site', 'map', ['--url', '{origin}/', '--limit', '10']),
  ok('extract fields', 'extract', [
    '--url',
    '{origin}/a',
    '--fields',
    'title:h1',
    '--selector',
    'p',
  ]),
  ok('summarize text', 'summarize', [
    '--text',
    'One idea. Two ideas here. Three.',
    '--sentences',
    '2',
  ]),
  ok('summarize a url', 'summarize', ['--url', '{origin}/a']),
  ok(
    'answer a question',
    'answer',
    ['--query', 'alpha', '--sources', '2', '--sentences', '2'],
    8000,
    8000,
  ),
  ok(
    'research a topic',
    'research',
    ['--topic', 'alpha', '--depth', '1', '--sentences', '2'],
    8000,
    8000,
  ),
  ok('research short flag', 'research', ['-t', 'beta'], 8000, 8000),
  ok('parse a file', 'parse', ['--file', '{tmp}/note.md']),
  ok('media download', 'media', [
    '--url',
    '{origin}/bytes?n=64',
    '--download',
    '-o',
    'bytes.bin',
    '--max-bytes',
    '1024',
  ]),
  usage('media screenshot needs a url', 'media', ['--screenshot'], 'url'),
  usage('media pdf needs a url', 'media', ['--pdf'], 'url'),
  ok('monitor a url', 'monitor', ['--url', '{origin}/a', '--db', '{tmp}/monitor.db']),
  ok('batch urls', 'batch', ['--urls', '{origin}/a,{origin}/b', '--concurrency', '2']),
  ok('batch input file', 'batch', ['--input', '{tmp}/urls.txt']),
  ok('doctor', 'doctor', [], 6000, 15000),
  ok('tasks', 'tasks', []),
  ok('mcp list', 'mcp', ['--list']),
  ok('diagram', 'diagram', []),
  ok('audit', 'audit', []),
  usage('act needs a url', 'act', ['--screenshot', 'shot.png'], 'url'),
  usage('act empty url', 'act', ['--url', ''], 'url'),
  ok('feed items', 'feed', ['--url', '{origin}/feed.xml', '--limit', '2', '--archive']),
  // Shared flags, each once: they are one parser for every command.
  { ...ok('ndjson output', 'map', ['--url', '{origin}/', '--ndjson']), json: false },
  ok('select fields', 'map', ['--url', '{origin}/', '--select', 'count']),
  {
    ...ok('output file', 'map', ['--url', '{origin}/', '--output', 'map.json'], 400, 8000),
    json: false,
  },
  ok('timeout flag', 'scrape', ['--url', '{origin}/a', '--timeout', '5000']),
  ok('removed format flag warns', 'diagram', ['--format', 'json', '--quiet']),
  // The router (bin/webular.ts through mise) and the standalone executable.
  { ...ok('router diagram', 'diagram', []), via: 'bin', maxMs: 8000 },
  { ...ok('router summarize', 'summarize', ['--text', 'One. Two.']), via: 'bin', maxMs: 8000 },
  { ...ok('executable diagram', 'diagram', []), via: 'exe', maxMs: 8000 },
  { ...ok('executable summarize', 'summarize', ['--text', 'One. Two.']), via: 'exe', maxMs: 8000 },
]

export interface McpCase {
  tool: string
  args: Record<string, unknown>
  error?: boolean
}

const HTML =
  '<html><head><title>T</title></head><body><h1>T</h1><p>Body text that is long enough for readability to keep it as the article.</p><a href="/a">a</a></body></html>'

export const MCP_CASES: McpCase[] = [
  { tool: 'web.fetch', args: { url: '{origin}/a', timeoutMs: 5000 } },
  { tool: 'web.fetch', args: { url: '{origin}/status?code=500' }, error: true },
  { tool: 'web.links', args: { html: HTML, base: '{origin}/', limit: 5 } },
  { tool: 'web.markdown', args: { html: HTML, select: ['markdown'] } },
  { tool: 'web.readability', args: { html: HTML, select: ['title'] } },
  // Every tool shares the paging inputs, so each one gets a select case and a
  // bad-cursor case.
  { tool: 'web.fetch', args: { url: '{origin}/a', select: ['url'] } },
  { tool: 'web.links', args: { html: HTML, base: '{origin}/', select: ['links'] } },
  ...['web.fetch', 'web.links', 'web.markdown', 'web.readability'].map((tool) => ({
    tool,
    args: { url: '{origin}/a', html: HTML, cursor: 'not-a-cursor' },
    error: true,
  })),
]

// Plugin cases: each runs one command from the repo root and passes on exit 0.
// `covers` names the coverage-map kinds it checks for every item of that kind:
// server.test.ts lists every plugin tool through a real stdio MCP client,
// `claude plugin validate` checks the manifest and each skill, and
// check-evals checks each skill's eval cases. A case whose `needs` binary is
// not on PATH is reported as skip, never pass.
// ponytail: the skills' model-graded evals need a model key, so this
// network-free run checks their eval files; run them with a key when one is set.
export interface PluginCase {
  name: string
  argv: string[]
  covers: string[]
  needs?: string
}

export const PLUGIN_CASES: PluginCase[] = [
  {
    name: 'every plugin tool over stdio',
    argv: [
      'bun',
      'test',
      '--timeout',
      '30000',
      '-t',
      'one typed tool',
      'plugins/webular/tests/server.test.ts',
    ],
    covers: ['plugin tool'],
  },
  {
    name: 'claude plugin validate',
    argv: ['claude', 'plugin', 'validate', 'plugins/webular'],
    covers: ['skill'],
    needs: 'claude',
  },
  {
    name: 'skill evals',
    argv: ['bun', 'plugins/webular/scripts/check-evals.ts'],
    covers: ['skill'],
  },
]
