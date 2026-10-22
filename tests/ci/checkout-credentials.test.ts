// Every workflow checkout drops its token from .git/config, so a later step
// (or a compromised action) cannot reuse it. No job pushes to main: only
// prune.yml runs `git push`, and only to its own prune/auto-* branch.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

const workflows = Effect.forEach(
  [...new Bun.Glob('.github/workflows/*.yml').scanSync(ROOT)].map((p) => p.replaceAll('\\', '/')),
  (path) => io(() => Bun.file(`${ROOT}${path}`).text()).pipe(Effect.map((yml) => ({ path, yml }))),
  { concurrency: 4 },
)

test(
  'each actions/checkout step sets persist-credentials: false',
  eff(
    Effect.gen(function* () {
      for (const { path, yml } of yield* workflows) {
        const steps = yml.split(/^\s*- /m).filter((s) => s.startsWith('uses: actions/checkout'))
        for (const step of steps)
          expect([path, step]).toEqual([
            path,
            expect.stringContaining('persist-credentials: false'),
          ])
      }
    }),
  ),
)

test(
  'only prune.yml runs git push, and only to a prune/auto-* branch, never main',
  eff(
    Effect.gen(function* () {
      for (const { path, yml } of yield* workflows) {
        const pushes = yml.split('\n').filter((line) => /\bgit\b.*\bpush\b/.test(line))
        if (!path.endsWith('/prune.yml')) {
          expect([path, pushes]).toEqual([path, []])
          continue
        }
        expect(yml).toMatch(/^\s*PRUNE_BRANCH: prune\/auto-\$\{\{ github\.run_id \}\}$/m)
        expect(pushes.length).toBeGreaterThan(0)
        for (const line of pushes) {
          expect(line).toEndWith('"HEAD:refs/heads/${PRUNE_BRANCH}"')
          expect(line).not.toMatch(/\bmain\b|--force|\s-f\b|--mirror|--all|--tags|--delete/)
        }
      }
    }),
  ),
)
