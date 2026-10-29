// A push skips its matrix only when an open pull request will really check
// the same commit. GitHub makes no pull_request run for a pull request with
// merge conflicts, so only a MERGEABLE one covers the push.
import { expect, test } from 'bun:test'
import { Effect, FileSystem, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
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

// The lookup script against a stand-in gh that prints `state`, or fails when
// `state` is null; returns the `covered` line it writes.
const covered = (script: string, state: string | null) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = yield* tmpDir('push-covered-')
    yield* fs.writeFileString(
      `${dir}/gh`,
      `#!/bin/sh\n${state === null ? 'exit 1' : `echo ${state}`}\n`,
    )
    yield* fs.chmod(`${dir}/gh`, 0o755)
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const command = ChildProcess.make('/bin/sh', ['-c', script], {
      env: { PATH: `${dir}:/usr/bin:/bin`, GITHUB_OUTPUT: `${dir}/out` },
    })
    const handle = yield* spawner.spawn(command)
    yield* handle.all.pipe(Stream.runDrain)
    yield* handle.exitCode
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
