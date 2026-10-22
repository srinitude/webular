// Preloaded by bunfig.toml. Under load on macOS, Bun's node:child_process can
// lose the 'exit' event and the output of the first child a bun test process
// spawns from a test (oven-sh/bun#46326, oven-sh/bun#45483). The Effect spawner
// then never settles, and that test's runProc waits out its whole timeout.
// Only the first spawn is hit, so this throwaway spawn takes that slot before
// any test runs. Its result is ignored, and its timeout bounds a lost exit.
import { beforeAll } from 'bun:test'
import { Effect } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { eff } from './run.ts'

beforeAll(eff(Effect.ignore(runProc([process.execPath, '-e', ''], { timeoutMs: 5_000 }))))
