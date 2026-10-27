// One MDX reference page per CLI command, built from the code `--help` reads:
// the usage and flag lines come from running each command's own `--help`, the
// text from COMMANDS, EXAMPLES, EXIT, docs/commands.md, the MCP tool list, and
// bench/scoreboard.json. Only the related links are typed per command.
// `bun scripts/docs-commands.ts <outdir>` writes <outdir>/<name>.mdx.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { commandTools } from '../plugins/webular/src/commands.ts'
import { COMMAND_NAMES, COMMANDS, type CommandName, EXAMPLES } from '../src/cli/commands.ts'
import { DISPATCH } from '../src/cli/dispatch-table.ts'
import { EXIT } from '../src/cli/exit-codes.ts'

const ROOT = new URL('..', import.meta.url).pathname

// A command not listed here points at doctor.
const RELATED: Partial<Record<CommandName, readonly CommandName[]>> = {
  search: ['answer', 'research', 'scrape'],
  scrape: ['batch', 'crawl', 'extract', 'summarize'],
  crawl: ['map', 'scrape', 'extract'],
  map: ['crawl', 'scrape'],
  extract: ['scrape', 'parse'],
  summarize: ['scrape', 'answer'],
  answer: ['search', 'research'],
  research: ['answer', 'search'],
  parse: ['scrape', 'extract'],
  media: ['scrape', 'act'],
  monitor: ['scrape', 'feed'],
  batch: ['scrape', 'crawl'],
  doctor: ['tasks', 'upgrade'],
  tasks: ['doctor', 'diagram'],
  mcp: ['doctor', 'tasks'],
  diagram: ['tasks'],
  act: ['media', 'scrape'],
  feed: ['monitor', 'scrape'],
  upgrade: ['doctor', 'completions'],
  completions: ['upgrade', 'doctor'],
}

const MEANING = {
  ok: 'Success.',
  failure: 'The command failed.',
  usage: 'Wrong usage, such as an unknown flag.',
  partial: 'Some items failed and the rest succeeded.',
} as const

const Scoreboard = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      command: Schema.String,
      metric: Schema.String,
      value: Schema.NullOr(Schema.Number),
      status: Schema.String,
      set: Schema.NullOr(Schema.String),
    }),
  ),
)
type Row = (typeof Scoreboard.Type)[number]

// MDX reads < > { } as markup. Backtick spans are literal, so only prose is escaped.
const esc = (text: string): string =>
  text
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/[<>{}]/g, '\\$&')))
    .join('')

const OPTION = /^ {2}((?:-\w, )?--[\w-]+)(?: (<[^>]+>))?\s*(.*)$/

const runHelp = (name: CommandName) =>
  Effect.flatMap(ChildProcessSpawner.ChildProcessSpawner, (spawner) =>
    spawner.string(
      ChildProcess.make(process.execPath, [`${ROOT}src/commands/${DISPATCH[name]}.ts`, '--help'], {
        cwd: ROOT,
      }),
    ),
  )

const flagRow = (line: string): string => {
  const [, flag = '', arg = '', meaning = ''] = OPTION.exec(line) ?? []
  const fallback = /\(default ([^;,)]+)[;,)]/.exec(meaning)?.[1]
  const cell = esc(meaning).replaceAll('|', '\\|')
  return `| ${flag
    .split(', ')
    .map((f) => `\`${f}\``)
    .join(', ')} | ${arg && `\`${arg}\``} | ${cell} | ${fallback ? `\`${fallback}\`` : ''} |`
}

const mcpSection = (name: CommandName): string => {
  const tool = commandTools.find((t) => t.id === name)
  if (tool) {
    const inputs = Object.keys(tool.inputSchema.shape).map((key) => `\`${key}\``)
    return `The \`${name}\` tool has the same name and inputs as the command: ${inputs.join(', ')}.`
  }
  return name === 'mcp'
    ? 'This command starts the MCP server, so it has no tool of its own.'
    : `\`${name}\` has no MCP tool.`
}

const scoreSection = (name: CommandName, board: ReadonlyArray<Row>): string[] => {
  const rows = board
    .filter((r) => r.command === name && r.status === 'measured' && r.value !== null)
    .map((r) => `- ${r.metric}: ${r.value} (${r.set})`)
  return rows.length
    ? [`## Score\n\nFrom the committed scoreboard (bench/scoreboard.json):\n\n${rows.join('\n')}`]
    : []
}

// Real output from the contract fixture site (scripts/docs-outputs.ts); none for other commands.
type Outputs = Partial<Record<CommandName, { args: string; text: string; json: string }>>
const outputSection = (name: CommandName, outputs: Outputs): string[] => {
  const run = outputs[name]
  if (!run) return []
  const json = JSON.stringify(JSON.parse(run.json), null, 2)
  return [
    `## Output\n\nRun against the repo's contract fixture page:\n\n\`\`\`bash\nwebular ${name} ${run.args}\n\`\`\`\n\n\`\`\`text\n${run.text || '(no text output)'}\n\`\`\`\n\nWith \`--json\`:\n\n\`\`\`json\n${json}\n\`\`\``,
  ]
}

// The docs/commands.md row, with `\|` unescaped and repo-relative links reduced to their text.
const whatItDoes = (name: CommandName, row: string): string =>
  esc(
    (row || COMMANDS[name])
      .replaceAll('\\|', '|')
      .replace(/\[([^\]]+)\]\((?!https?:)[^)]*\)/g, '$1'),
  )

const page = (
  name: CommandName,
  help: string,
  row: string,
  board: ReadonlyArray<Row>,
  outputs: Outputs,
): string => {
  const lines = help.split('\n')
  const usage = (lines[lines.indexOf('USAGE') + 1] ?? '').trim()
  const from = lines.indexOf('OPTIONS') + 1
  const flags = lines.slice(from, lines.indexOf('', from)).map(flagRow)
  const codes = (['ok', 'failure', 'usage', 'partial'] as const)
    .filter((key) => key !== 'partial' || name === 'batch')
    .map((key) => `- \`${EXIT[key]}\`: ${MEANING[key]}`)
  const related = (RELATED[name] ?? ['doctor']).map((r) => `- [\`${r}\`](/reference/commands/${r})`)
  return `${[
    `---\ntitle: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(COMMANDS[name])}\n---`,
    `## Synopsis\n\n\`\`\`bash\n${usage}\n\`\`\``,
    `## What it does\n\n${whatItDoes(name, row)}`,
    `## Flags\n\n| Flag | Argument | Meaning | Default |\n|---|---|---|---|\n${flags.join('\n')}`,
    `## Example\n\n\`\`\`bash\n${EXAMPLES[name]}\n\`\`\``,
    ...outputSection(name, outputs),
    `## Exit codes\n\n${codes.join('\n')}\n\nSee [Exit codes](/reference/exit-codes) for the rest.`,
    `## MCP tool\n\n${mcpSection(name)}`,
    ...scoreSection(name, board),
    `## Related\n\n${related.join('\n')}`,
  ].join('\n\n')}\n`
}

// One { name, mdx } per key of COMMANDS, in COMMANDS order.
export const commandPages = (): Effect.Effect<
  ReadonlyArray<{ name: CommandName; mdx: string }>,
  unknown,
  FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const doc = yield* fs.readFileString(`${ROOT}docs/commands.md`)
    const board = yield* fs
      .readFileString(`${ROOT}bench/scoreboard.json`)
      .pipe(Effect.flatMap(Schema.decodeUnknownEffect(Scoreboard)))
    const outputs = JSON.parse(
      yield* fs.readFileString(`${ROOT}docs/site/reference/command-output.json`),
    ) as Outputs
    const helps = yield* Effect.forEach(COMMAND_NAMES, runHelp, { concurrency: 4 })
    return COMMAND_NAMES.map((name, i) => {
      const row = new RegExp(`^\\| \`${name}\`\\s*\\| (.*) \\|$`, 'm').exec(doc)?.[1] ?? ''
      return { name, mdx: page(name, helps[i] ?? '', row, board, outputs) }
    })
  })

if (import.meta.main) {
  const out = Bun.argv[2] ?? ''
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(out, { recursive: true })
    for (const { name, mdx } of yield* commandPages())
      yield* fs.writeFileString(`${out}/${name}.mdx`, mdx)
    yield* Effect.log(`docs commands: wrote ${COMMAND_NAMES.length} pages to ${out}`)
  }).pipe(Effect.provide(BunServices.layer), BunRuntime.runMain)
}
