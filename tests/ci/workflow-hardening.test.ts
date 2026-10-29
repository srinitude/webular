// Supply-chain rules for every workflow (.github/workflows/AGENTS.md): a
// least-privilege token, no `${{ }}` inside a `run:` script, no
// pull_request_target, and no long-lived npm token beside trusted publishing.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

const workflows = Effect.forEach(
  [...new Bun.Glob('.github/workflows/*.yml').scanSync(ROOT)],
  (path) => io(() => Bun.file(`${ROOT}${path}`).text()).pipe(Effect.map((yml) => ({ path, yml }))),
  { concurrency: 10 },
)

// A block script's lines: everything indented deeper than its `run:` key.
const blockLines = (lines: ReadonlyArray<string>, from: number, indent: number) => {
  const end = lines.findIndex((l, j) => j >= from && l.trim() !== '' && l.search(/\S/) <= indent)
  return lines.slice(from, end < 0 ? lines.length : end)
}

// The lines of every `run:` script, inline or block.
const runLines = (yml: string) =>
  yml.split('\n').flatMap((line, i, lines) => {
    const m = line.match(/^(\s*)(?:- )?run:\s*(.*)$/)
    if (!m) return []
    if (m[2] && !/^[|>][-+]?$/.test(m[2])) return [m[2]]
    return blockLines(lines, i + 1, (m[1] ?? '').length)
  })

test(
  'each workflow starts read-only or empty and never uses pull_request_target or workflow_run',
  eff(
    Effect.gen(function* () {
      for (const { path, yml } of yield* workflows) {
        expect([path, yml]).toEqual([
          path,
          expect.stringMatching(/^permissions:(?: \{\}|\n {2}contents: read)$/m),
        ])
        expect([path, yml.includes('pull_request_target')]).toEqual([path, false])
        expect([path, /^\s+workflow_run:/m.test(yml)]).toEqual([path, false])
      }
    }),
  ),
)

test(
  'no run script interpolates a GitHub expression; values pass through env',
  eff(
    Effect.gen(function* () {
      for (const { path, yml } of yield* workflows)
        expect([path, runLines(yml).filter((l) => l.includes('${{'))]).toEqual([path, []])
    }),
  ),
)

// GitHub Packages takes the run's own short-lived GITHUB_TOKEN; no stored npm token.
const RUN_TOKEN = /NODE_AUTH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/g

test(
  'npm publishing is trusted publishing: OIDC, provenance, and no stored npm token',
  eff(
    Effect.gen(function* () {
      for (const { path, yml } of yield* workflows)
        expect([
          path,
          /NPM_TOKEN|NODE_AUTH_TOKEN|secrets\.NPM/.test(
            yml.replace(/#.*$/gm, '').replace(RUN_TOKEN, ''),
          ),
        ]).toEqual([path, false])
      const release = (yield* workflows).find((w) => w.path.endsWith('release.yml'))?.yml ?? ''
      const publish = release.slice(
        release.indexOf('\n  publish:'),
        release.indexOf('\n  publish-github-packages:'),
      )
      expect(publish).toMatch(/permissions:\n\s+contents: read[^\n]*\n\s+id-token: write/)
      for (const line of publish.match(/npm publish --[^\n]*/g) ?? [])
        expect(line).toContain('--provenance')
    }),
  ),
)
