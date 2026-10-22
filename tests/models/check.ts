// Deterministic evals over a reply: the same text always gives the same
// problems list. An empty list is a pass.
import type { Eval, Scenario, Surface } from './scenarios.ts'

export interface Ctx {
  origin: string
  tmp: string
}

// {tmp} always fills with forward slashes: Windows accepts them, and a
// backslash path would come back escaped as \\ in --json output, so the
// filled path would never match the reply text.
const slashTmp = (ctx: Ctx) => ctx.tmp.replaceAll('\\', '/')

export const fill = (s: string, ctx: Ctx) =>
  s.replaceAll('{origin}', ctx.origin).replaceAll('{tmp}', slashTmp(ctx))

export const unfill = (raw: string, ctx: Ctx) =>
  raw.replaceAll(ctx.origin, '{origin}').replaceAll(slashTmp(ctx), '{tmp}')

export const evaluate = (ev: Eval, text: string, ctx: Ctx): string[] => [
  ...(ev.answerContains ?? [])
    .map((v) => fill(v, ctx))
    .filter((v) => !text.includes(v))
    .map((v) => `reply lacks "${v}"`),
  ...(ev.answerMatches && !new RegExp(fill(ev.answerMatches, ctx), 'i').test(text)
    ? [`reply does not match /${ev.answerMatches}/`]
    : []),
]

export interface ToolUse {
  name: string
  input: unknown
}

// The run reached the scenario's capability on its surface: a webular command
// through Bash, or the named MCP tool (or resource reader).
export const usedTool = (uses: readonly ToolUse[], surface: Surface, tool: string): boolean =>
  uses.some((u) =>
    surface === 'cli'
      ? u.name === 'Bash' && new RegExp(`\\bwebular\\s+${tool}\\b`).test(JSON.stringify(u.input))
      : tool === 'ReadMcpResourceTool'
        ? u.name === tool
        : u.name.endsWith(`__${tool}`),
  )

// Any webular tool on the surface: the rule each rival arm gets for its own tools.
export const usedAnyWebular =(uses: readonly ToolUse[], surface: Surface): boolean =>
  uses.some((u) =>
    surface === 'cli'
      ? u.name === 'Bash' && /\bwebular\s+\w/.test(JSON.stringify(u.input))
      : u.name.startsWith(surface === 'plugin' ? 'mcp__plugin_webular_webular__' : 'mcp__webular__'),
  )

// The "never called" problem, unless the scenario grades the outcome alone,
// plus one problem per avoided tool the run called instead.
export const toolProblems = (
  s: Pick<Scenario, 'tool' | 'requireTool' | 'anyTool' | 'avoidTools'>,
  uses: readonly ToolUse[],
  surface: Surface,
): string[] => [
  ...(s.requireTool === false ||
  (s.anyTool ? usedAnyWebular(uses, surface) : usedTool(uses, surface, s.tool))
    ? []
    : [`never called ${s.anyTool ? 'a webular tool' : s.tool} on the ${surface} surface`]),
  ...(s.avoidTools ?? [])
    .filter((t) => usedTool(uses, surface, t))
    .map((t) => `called ${t} where one ${s.tool} call does the job`),
]

// A peer arm passes the tool check once it called any of its own MCP tools.
export const peerProblems = (
  s: Pick<Scenario, 'requireTool'>,
  uses: readonly ToolUse[],
  provider: string,
): string[] =>
  s.requireTool === false || uses.some((u) => u.name.startsWith(`mcp__${provider}__`))
    ? []
    : [`never called a ${provider} tool on the peer surface`]

// One label per failed row, so a harness artifact (no call at all, a cut-off
// run) is told apart from a real wrong answer. Skipped rows get none.
export const missOf = (problems: readonly string[]) =>
  problems.includes('timed out')
    ? 'timeout'
    : problems.some((p) => p.startsWith('never called'))
      ? 'never-called'
      : problems.some((p) => p.startsWith('reply '))
        ? 'wrong-answer'
        : null
