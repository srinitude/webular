// mise run jev:docs: refresh and verify the Jev docs snapshot.
// Live (default): conditional GET of llms-full.txt against the committed snapshot;
// a 200 rewrites the recording and the snapshot, a 304 keeps both.
// --replay: re-prove the committed recording offline (what CI on a PR does).
import { BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import { refresh } from '../src/lib/jev/docs-fetch.ts'
import { committedSnapshot, httpFetcher } from '../src/lib/jev/docs-guard.ts'
import { DECISION_MODELS, prove } from '../src/lib/jev/docs-snapshot.ts'

const root = `${import.meta.dir}/..`
const recording = `${root}/tests/fixtures/jev-docs/llms-full.txt`
const snapshotFile = `${root}/src/lib/jev/docs-snapshot.json`
const jev = DECISION_MODELS[0] as (typeof DECISION_MODELS)[number]

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const replay = process.argv.includes('--replay')
  const text = yield* fs.readFileString(recording)
  let snap = prove(jev.id, String(jev.docs), text, committedSnapshot)
  if (snap === undefined)
    return yield* Effect.fail(new Error('recording no longer states every limit'))
  if (!replay) {
    const http = yield* HttpClient.HttpClient
    let body = ''
    const get = httpFetcher(http)
    snap = yield* refresh(
      jev,
      snap,
      (u, c) => get(u, c).pipe(Effect.tap((r) => Effect.sync(() => (body = r.text)))),
      (l) => Console.log(`jev:docs ${l.event} ${l.reason ?? ''}`),
    )
    if (body !== '') yield* fs.writeFileString(recording, body)
  }
  yield* fs.writeFileString(snapshotFile, `${JSON.stringify(snap, null, 2)}\n`)
  yield* Console.log(
    `jev:docs verified ${snap.lines} lines, sha256 ${snap.sha256}, chunks ${JSON.stringify(snap.chunks)}`,
  )
  if (replay && snap.sha256 !== committedSnapshot.sha256)
    return yield* Effect.fail(new Error('committed snapshot does not match the recording'))
})

Effect.runPromise(program.pipe(Effect.provide([FetchHttpClient.layer, BunServices.layer])))
