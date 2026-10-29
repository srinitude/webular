// A push skips its matrix only when an open pull request will really check
// the same commit. GitHub makes no pull_request run for a pull request with
// merge conflicts, so only a MERGEABLE one covers the push.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff, tmpDir } from '../_support/run.ts'

type Step = { readonly id?: string; readonly run?: string }
type Workflow = { readonly jobs: Record<string, { readonly steps?: ReadonlyArray<Step> }> }

const lookup = (name: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.readFileString(`${ROOT}.github/workflows/${name}`),
  ).pipe(
    Effect.map((yml) => Bun.YAML.parse(yml) as Workflow),
    Effect.map(
      (w) => w.jobs['push-covered-by-pr']?.steps?.find((s) => s.id === 'lookup')?.run ?? '',
    ),
  )

// The lookup script against a stand-in gh, a shell function that prints
// `state`, or fails when `state` is null; returns the `covered` line it writes.
// `sh` from PATH and a relative GITHUB_OUTPUT, so Windows (Git's sh) runs it too.
const covered = (script: string, state: string | null) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = yield* tmpDir('push-covered-')
    const gh = `gh() { ${state === null ? 'return 1' : `echo ${state}`}; }`
    const { code, stderr } = yield* runProc(['sh', '-c', `${gh}\n${script}`], {
      cwd: dir,
      env: { GITHUB_OUTPUT: 'out' },
      extendEnv: true,
      timeoutMs: 20_000,
    })
    expect({ code, stderr }).toMatchObject({ code: 0 })
    return (yield* fs.readFileString(`${dir}/out`)).trim()
  }).pipe(Effect.scoped)

test(
  'a push to a pull request with merge conflicts still runs the full matrix',
  eff(
    Effect.gen(function* () {
      for (const name of ['ci.yml', 'plugin.yml']) {
        const script = yield* lookup(name)
        expect([name, yield* covered(script, 'MERGEABLE')]).toEqual([name, 'covered=true'])
        expect([name, yield* covered(script, 'CONFLICTING')]).toEqual([name, 'covered=false'])
        expect([name, yield* covered(script, 'NONE')]).toEqual([name, 'covered=false'])
        expect([name, yield* covered(script, null)]).toEqual([name, 'covered=false'])
      }
    }),
  ),
)
