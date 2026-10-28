// Guard: the neutral core names no single agent host and no one machine's
// paths. Host-specific wording lives only in the adapter files listed below,
// each with its reason. A hit outside the list fails, and so does a listed
// file that holds no hit, so the list stays exact.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

// POSIX ERE, so git grep and JS RegExp read it the same way.
const HOST_SPECIFIC = [
  'Claude Code',
  'claude mcp add',
  'codex mcp add',
  'CLAUDE_PLUGIN_ROOT',
  '/\\.claude/mods',
  '~/\\.claude',
  '/Users/[a-z][a-z0-9_-]*/',
  '/home/[a-z][a-z0-9_-]*/',
].join('|')

// Recorded data and history, not framing.
const DATA = [
  ':!bench/results',
  ':!bench/datasets',
  ':!docs/research',
  ':!tests/fixtures',
  ':!tests/models/fixtures',
  ':!.markdown-chain',
  ':!CHANGELOG.md',
  ':!bun.lock',
  ':!plugins/webular/dist',
  ':!tests/quality/host-neutral.test.ts',
]

// The install page, its content, and the home page show one setup line per agent host.
const SITE_ADAPTERS: Readonly<Record<string, string>> = {
  'site/src/InstallBlock.astro': 'install block names each agent host',
  'site/src/content/install.md': 'one setup line per MCP client',
  'site/src/routes/index.astro': 'home page shows the Claude Code install line',
  'docs/site/agents/index.mdx': 'one setup tab per MCP client',
}

const ADAPTERS: Readonly<Record<string, string>> = {
  '.claude-plugin/AGENTS.md': 'Claude Code marketplace adapter note',
  '.claude/AGENTS.md': 'Claude Code project-settings adapter',
  '.claude/hooks/AGENTS.md': 'Claude Code hook adapter',
  'AGENTS.md': 'the bridges rule names each host adapter',
  'README.md': 'host one-liners beside the neutral mcpServers block',
  'docs/AGENTS.md': 'the marketplace install line needs a Claude Code build',
  'docs/how-it-works.md': 'names Claude Code as one marketplace host',
  'docs/install.md': 'one setup section per MCP client',
  'docs/tasks.md': 'generated from mise.toml, which names the model bench host',
  'mise.toml': 'the model bench drives a headless host',
  'plugins/webular/.claude-plugin/AGENTS.md': 'Claude Code plugin manifest adapter note',
  'plugins/webular/.mcp.json': 'Claude Code server adapter manifest',
  'plugins/webular/evals/harness.json': 'eval of the Claude Code manifest drift',
  'plugins/webular/tests/manifests.test.ts': 'adapter drift test',
  ...SITE_ADAPTERS,
  'tests/contract/plugin-tools.test.ts': 'checks the Claude Code adapter manifest',
  'tests/contract/skills.test.ts': 'checks the Claude Code adapter manifest',
  'tests/engine/cua-act-guard.test.ts': 'per-OS browser profile path fixtures',
  'tests/engine/cua-background.test.ts': 'per-OS browser profile path fixtures',
  'tests/engine/cua-os.test.ts': 'per-OS browser profile path fixtures',
  'tests/lib/home-fallback.test.ts': 'Windows home path fixture',
  'tests/models/agent/arm.ts': 'the model bench drives a headless host',
  'tests/models/run.ts': 'the model bench drives a headless host',
  'tests/quality/claude-md-bridges.test.ts': 'CLAUDE.md adapter drift test',
  'tests/quality/readme-facts.test.ts': 'checks the README host one-liners',
  'tests/release/install-ps1.test.ts': 'install path fixture',
  'tests/release/upgrade.test.ts': 'per-OS package manager path fixtures',
}

// git grep exits 1 for no match and 2 for a bad pattern or path.
const hits = runProc(['git', 'grep', '-lIE', HOST_SPECIFIC, '--', '.', ...DATA], {
  timeoutMs: 20_000,
  cwd: ROOT,
}).pipe(
  Effect.map(({ code, stdout }) =>
    code > 1 ? ['git grep failed'] : stdout.split('\n').filter(Boolean),
  ),
)

const problems = (found: ReadonlyArray<string>) => [
  ...found.filter((p) => !(p in ADAPTERS)).map((p) => `${p}: host-specific outside the adapters`),
  ...Object.keys(ADAPTERS)
    .filter((p) => !found.includes(p))
    .map((p) => `${p}: listed as an adapter but holds no host wording`),
]

describe('host-neutral core', () => {
  test(
    'host wording and machine paths stay in the listed adapters',
    eff(Effect.map(hits, (found) => expect(problems(found)).toEqual([]))),
    30_000,
  )

  test('the pattern catches host wording and machine paths, not neutral text', () => {
    const re = new RegExp(HOST_SPECIFIC)
    for (const bad of ['In Claude Code:', 'see ~/.claude/x', 'cd /Users/kiren/x', '/home/ana/.x'])
      expect(re.test(bad)).toBe(true)
    for (const ok of ['your agent host', 'an MCP client', '$HOME/.local/share'])
      expect(re.test(ok)).toBe(false)
  })

  test('a stray hit and a stale entry are both reported', () => {
    const found = Object.keys(ADAPTERS).filter((p) => p !== 'docs/install.md')
    expect(problems([...found, 'src/x.ts'])).toEqual([
      'src/x.ts: host-specific outside the adapters',
      'docs/install.md: listed as an adapter but holds no host wording',
    ])
  })
})
