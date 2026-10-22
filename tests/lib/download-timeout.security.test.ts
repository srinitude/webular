// downloadToFile bounds the whole download with its own timeout, not the 30 s
// per-request default, and a caller can set it.

import { afterAll, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { downloadToFile } from '../../src/lib/download.ts'

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch: () =>
    new Response(
      new ReadableStream({
        async pull(c) {
          await Bun.sleep(100)
          c.enqueue(new Uint8Array(8)) // a steady trickle that never ends
        },
      }),
    ),
})
const dir = mkdtempSync(join(tmpdir(), 'dl-timeout-'))
afterAll(() => {
  server.stop(true)
  rmSync(dir, { recursive: true, force: true })
})

test('a download past its timeout fails instead of running on', async () => {
  const started = Date.now()
  const run = downloadToFile(`http://127.0.0.1:${server.port}/`, join(dir, 'f'), { timeoutMs: 500 })
  const err = await Effect.runPromise(Effect.flip(run).pipe(Effect.provide(BunServices.layer)))
  expect(err.message).toBeTruthy()
  expect(Date.now() - started).toBeLessThan(3_000)
}, 6_000)
