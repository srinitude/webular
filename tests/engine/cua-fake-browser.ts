// Stand-in browser for cua-session-leak.effect.test.ts: sleeps until the test ends.
// Its command line carries the --user-data-dir the throwaway-profile guard reads.
import { BunRuntime } from '@effect/platform-bun'
import { Effect } from 'effect'

BunRuntime.runMain(Effect.sleep('30 seconds'))
