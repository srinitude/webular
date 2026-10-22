// Every e2e case as data. `{origin}` is the shared fixture server; `{tmp}` is
// the run's private temp folder. Each case states its exit code, whether
// stdout is one JSON object, the stderr text on errors, a ceiling on output
// characters (about 4 per token), and a latency budget. Ceilings and budgets
// are a measured macOS run times about 3, rounded up, so slower CI runners
// still pass.
import type { CommandName } from '../../src/cli/commands.ts'
import { FLAG_CASES } from './flag-cases.ts'

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
  env?: Record<string, string>
}

// The fixture's search results link to its own 127.0.0.1 pages, and the address
// guard blocks private links found in search results in every mode. These cases
// opt in on purpose; the guard itself stays on for every other case.
const PRIVATE_FIXTURE = { WEBULAR_ALLOW_PRIVATE: '1' }

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
  usage(
    'search too many variants',
    'search',
    ['bun', '--variant', 'a', '--variant', 'b', '--variant', 'c'],
    '--variant',
  ),
  ok('scrape a page', 'scrape', ['--url', '{origin}/a', '--archive']),
  ok('scrape past robots.txt', 'scrape', ['--url', '{origin}/a', '--ignore-robots']),
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
  {
    ...ok(
      'answer a question',
      'answer',
      ['--query', 'alpha', '--sources', '2', '--sentences', '2'],
      8000,
      8000,
    ),
    env: PRIVATE_FIXTURE,
  },
  ok('answer from given urls', 'answer', ['--query', 'alpha', '--urls', '{origin}/a'], 8000, 8000),
  {
    ...ok(
      'research a topic',
      'research',
      ['--topic', 'alpha', '--depth', '1', '--sentences', '2'],
      8000,
      8000,
    ),
    env: PRIVATE_FIXTURE,
  },
  { ...ok('research short flag', 'research', ['-t', 'beta'], 8000, 8000), env: PRIVATE_FIXTURE },
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
  ok('monitor watch-for', 'monitor', ['{origin}/a', '--db', '{tmp}/mw.db', '--watch-for', 'price']),
  ok('batch urls', 'batch', ['--urls', '{origin}/a,{origin}/b', '--concurrency', '2']),
  ok('batch input file', 'batch', ['--input', '{tmp}/urls.txt']),
  ok('doctor', 'doctor', [], 6000, 15000),
  ok('tasks', 'tasks', []),
  ok('mcp list', 'mcp', ['--list']),
  ok('diagram', 'diagram', []),
  ok('audit', 'audit', []),
  usage('act needs a url', 'act', ['--screenshot', 'shot.png'], 'url'),
  usage('act empty url', 'act', ['--url', ''], 'url'),
  usage('act goal needs a window', 'act', ['--goal', 'click "Save"'], 'WEBULAR_CUA_WINDOW'),
  ok('feed items', 'feed', ['--url', '{origin}/feed.xml', '--limit', '2', '--archive']),
  usage('jev needs a known subcommand', 'jev', ['bogus'], 'jev'),
  // The plugin's flag form; an unknown action fails before any Jev call.
  usage('jev flags', 'jev', ['--action', 'x', '--id', 'c', '--label', 'y', '--input', 'i'], 'x'),
  // Shared flags, each once: they are one parser for every command.
  { ...ok('ndjson output', 'map', ['--url', '{origin}/', '--ndjson']), json: false },
  ok('select fields', 'map', ['--url', '{origin}/', '--select', 'count']),
  {
    ...ok('output file', 'map', ['--url', '{origin}/', '--output', 'map.json'], 400, 8000),
    json: false,
  },
  ok('timeout flag', 'scrape', ['--url', '{origin}/a', '--timeout', '5000']),
  ...FLAG_CASES,
  ok('removed format flag warns', 'diagram', ['--format', 'json', '--quiet']),
  // The router (bin/webular.ts through mise) and the standalone executable.
  { ...ok('router diagram', 'diagram', []), via: 'bin', maxMs: 8000 },
  { ...ok('router summarize', 'summarize', ['--text', 'One. Two.']), via: 'bin', maxMs: 8000 },
  { ...ok('executable diagram', 'diagram', []), via: 'exe', maxMs: 8000 },
  { ...ok('executable summarize', 'summarize', ['--text', 'One. Two.']), via: 'exe', maxMs: 8000 },
]

export { MCP_CASES, type McpCase } from './mcp-cases.ts'
export { PLUGIN_CASES, type PluginCase } from './plugin-cases.ts'
