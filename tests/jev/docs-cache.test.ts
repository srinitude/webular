// Docs snapshot cache contract: a docs check persists across process runs, so the
// second run within the freshness window does no fetch.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import { fileStore } from '../../src/lib/jev/docs-cache.ts'
import { committedSnapshot, guarded } from '../../src/lib/jev/docs-guard.ts'
import type { Headers } from '../../src/lib/jev/docs-snapshot.ts'
import { docs, noul, req, runFs } from './docs-guard-support.ts'

test('two sequential runs: the second reads the saved check and does no fetch', () =>
  runFs(
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const dir = yield* fs.makeTempDirectoryScoped()
        const text = `${yield* docs}A new line.\n`
        let fetches = 0
        const get = (_: string, __: Headers) =>
          Effect.sync(() => {
            fetches++
            return { status: 200, text, lastModified: 'later' }
          })
        // A new process: fresh in-memory state, the same cache file on disk.
        const run = Effect.suspend(() => {
          const store = fileStore(fs, `${dir}/jev-docs.json`)
          const state = { snapshot: committedSnapshot, store }
          const body = JSON.stringify(req(noul))
          return guarded(body, state, get, () => Effect.void, Effect.void).pipe(Effect.as(state))
        })
        yield* run
        expect(fetches).toBe(1)
        const second = yield* run
        expect(fetches).toBe(1)
        expect(second.snapshot?.sha256).not.toBe(committedSnapshot.sha256)
      }),
    ),
  ))
