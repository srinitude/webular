// Static bug-class guards from docs/bug-classes.md: each rule is a pattern
// that must match no code line in its files. Read-only; fails on any hit.
// Usage: bun scripts/bugs-check.ts [root]
import { BunRuntime } from '@effect/platform-bun'
import { Console, Effect } from 'effect'

type Rule = {
  readonly name: string
  readonly pattern: RegExp
  readonly globs: ReadonlyArray<string>
  // Files with known hits a hunt helper still owns; remove each once fixed.
  readonly known?: ReadonlyArray<string>
}

const SRC = ['src/**/*.ts', 'plugins/webular/src/**/*.ts']

export const RULES: ReadonlyArray<Rule> = [
  {
    name: 'MCP stdout carries only JSON-RPC: log to stderr',
    pattern: /console\.(log|info|debug|table)\(|process\.stdout\.write|Bun\.stdout/,
    globs: ['src/commands/mcp.ts', 'src/machines/mcp-serve.ts', 'plugins/webular/src/**/*.ts'],
  },
  { name: 'no `as any`: decode with a schema', pattern: /\bas any\b|<any>/, globs: SRC },
  {
    name: 'decode JSON with a schema, not a cast',
    pattern: /JSON\.parse\([^;]*\)\s*as\s/,
    globs: SRC,
  },
  {
    name: 'no shell strings: spawn an argv array',
    pattern: /shell:\s*true|\bexecSync\(|\bexec\b.*'node:child_process'|Bun\.\$`/,
    globs: [...SRC, 'scripts/**/*.ts'],
  },
  {
    name: 'no raw fetch: use the HttpClient with a timeout',
    pattern: /(^|[^.\w])fetch\(/,
    globs: SRC,
  },
]

const fileHits = (root: string, rule: Rule, file: string) =>
  Effect.map(
    Effect.tryPromise(() => Bun.file(`${root}/${file}`).text()),
    (text) =>
      text
        .split('\n')
        .flatMap((line, i) =>
          rule.pattern.test(line) && !line.trimStart().startsWith('//')
            ? [`${rule.name}: ${file}:${i + 1}: ${line.trim()}`]
            : [],
        ),
  )

const ruleHits = (root: string, rule: Rule) =>
  Effect.forEach(
    rule.globs
      .flatMap((g) => Array.from(new Bun.Glob(g).scanSync({ cwd: root })))
      // Glob yields `\` paths on Windows; hits and `known` use `/`.
      .map((file) => file.replaceAll('\\', '/'))
      .filter((file) => !rule.known?.includes(file)),
    (file) => fileHits(root, rule, file),
    { concurrency: 8 },
  )

export const scan = (root: string) =>
  Effect.map(
    Effect.forEach(RULES, (rule) => ruleHits(root, rule), { concurrency: 1 }),
    (found) => found.flat(2),
  )

if (import.meta.main)
  scan(process.argv[2] ?? `${import.meta.dir}/..`).pipe(
    Effect.flatMap((hits) =>
      hits.length === 0
        ? Console.error(`bugs:check OK (${RULES.length} guards)`)
        : Effect.andThen(Console.error(hits.join('\n')), Effect.fail(`${hits.length} hits`)),
    ),
    BunRuntime.runMain,
  )
