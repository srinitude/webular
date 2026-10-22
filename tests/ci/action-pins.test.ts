// Every `uses:` in every workflow is pinned to the commit its version comment
// names. A SHA that is a tag object (an annotated tag's own id, not the commit
// it points at) looks pinned but is not a commit, so Actions cannot resolve it.
// PINS holds each action's commit, read with
// `git ls-remote https://github.com/<owner>/<repo> refs/tags/<tag> refs/tags/<tag>^{}`
// (the ^{} line when the tag is annotated, else the tag line). Dependabot's
// action bumps update this table in the same pull request.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

const PINS: Record<string, string> = {
  'actions/attest@v4.2.2': '1e69f48acb82d1966a394da916b4c1698aa569d6',
  'actions/cache@v6.1.0': '55cc8345863c7cc4c66a329aec7e433d2d1c52a9',
  'actions/checkout@v7.0.1': '3d3c42e5aac5ba805825da76410c181273ba90b1',
  'actions/setup-node@v7.1.0': '949feb2413d6458794dcd2491c4babbbce0c15c1',
  'actions/upload-artifact@v7.0.2': 'cf430e030ddbb5b0abf93d22962f4752f3646cd9',
  'anchore/sbom-action@v0.24.3': '66cbf4bc1f1c0d2edc94016e65bc221b6bb0ad6c',
  'github/codeql-action@v4.39.1': '9b3254085494b55a0f7c4c2b3d2d52cc712ce370',
  'jdx/mise-action@v5.2.1': 'fc42bcc7ddbf51124c30f95a877a0c5168a3bfde',
  'ossf/scorecard-action@v2.5.0': 'fa7117db83c52d787ae5a89f350999701505d78e',
  'oven-sh/setup-bun@v2.2.0': '0c5077e51419868618aeaa5fe8019c62421857d6',
}

test(
  'every workflow action is pinned to the commit its version comment names',
  eff(
    Effect.gen(function* () {
      let count = 0
      for (const path of new Bun.Glob('.github/workflows/*.yml').scanSync(ROOT)) {
        const yml = yield* io(() => Bun.file(`${ROOT}${path}`).text())
        for (const m of yml.matchAll(/^\s*(?:- )?uses:\s*(\S+)@(\S+)[ \t]+#[ \t]*(\S+)/gm)) {
          const [, action = '', sha = '', tag = ''] = m
          // codeql-action/init, /analyze, and /upload-sarif share one repository.
          const repo = action.split('/').slice(0, 2).join('/')
          count++
          expect([path, action, tag, sha]).toEqual([path, action, tag, PINS[`${repo}@${tag}`] ?? 'unlisted pin'])
        }
        // No `uses:` without a SHA and a version comment.
        const uses = [...yml.matchAll(/^\s*(?:- )?uses:/gm)].length
        const pinned = [...yml.matchAll(/^\s*(?:- )?uses:\s*\S+@[0-9a-f]{40}[ \t]+#[ \t]*v\S+/gm)]
          .length
        expect([path, pinned]).toEqual([path, uses])
      }
      expect(count).toBeGreaterThan(0)
    }),
  ),
)
