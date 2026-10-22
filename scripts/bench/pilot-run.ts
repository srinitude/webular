// Image pilot runner: both arms on every pilot task. The text arm reads page
// text; the image arm asks the Jev router where the answer sits and, for image
// or both, adds the full-page screenshot. Run: bun scripts/bench/pilot-run.ts --runs 3
// with WEBULAR_JEV_MODEL set to the Jev release under test.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Clock, Effect, FileSystem, Layer } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import { Jev } from '../../src/lib/jev/client.ts'
import { imageInventory, routeImages } from '../../src/lib/jev/decisions/image-router.ts'
import { loadSetFile } from './loader.ts'
import { type Arm, keepFailures, type PilotResult, SURE_CONFIDENCE, scoreArm } from './pilot.ts'
import { EMPTY, fetchPage, graded, OUT, type Page, read, type Task } from './pilot-io.ts'

const JEV_USD = 0.0001 // ponytail: flat per Jev call, swap for metered cost when the client reports it
const runsArg = Number(process.argv[process.argv.indexOf('--runs') + 1]) || 1

const route = (t: Task, p: Page) =>
  routeImages(
    {
      question: t.question,
      page: { url: t.url, excerpt: p.text },
      images: imageInventory(p.images),
    },
    t.kind,
  )

const armRow = (t: Task, p: Page, arm: Arm) =>
  Effect.gen(function* () {
    const start = yield* Clock.currentTimeMillis
    const place = arm === 'image' ? yield* route(t, p) : 'text'
    const r = yield* read(t, p, place !== 'text')
    const ms = (yield* Clock.currentTimeMillis) - start
    // Zero-image pages skip the router, so they cost no Jev call.
    const usd = r.usd + (arm === 'image' && p.images.length > 0 ? JEV_USD : 0)
    const correct = graded(r.answer, t.gold)
    const row: PilotResult & { kind: string; ms: number; place: string; id: string } = {
      arm,
      correct,
      confidence: r.confidence,
      usd,
      kind: t.kind,
      ms,
      place,
      id: t.id,
    }
    return row
  })

type Row = Effect.Success<ReturnType<typeof armRow>>
const p50 = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0
const ofKind = (rows: Row[], k: string) => rows.filter((r) => r.kind === k)
const kindPair = (rows: Row[], k: string) =>
  [scoreArm('text-only', ofKind(rows, k)), scoreArm('image', ofKind(rows, k))] as const

const armReport = (rows: Row[], arm: Arm, kinds: string[]) => {
  const mine = rows.filter((r) => r.arm === arm)
  return {
    arm,
    n: mine.length,
    ...scoreArm(arm, rows),
    sureButWrong: mine.filter((r) => !r.correct && r.confidence >= SURE_CONFIDENCE).length,
    p50ms: p50(mine.map((r) => r.ms)),
    byKind: Object.fromEntries(kinds.map((k) => [k, scoreArm(arm, ofKind(rows, k)).passRate])),
  }
}

const report = (rows: Row[]) => {
  const kinds = [...new Set(rows.map((r) => r.kind))]
  const img = rows.filter((r) => r.arm === 'image')
  return {
    arms: [armReport(rows, 'text-only', kinds), armReport(rows, 'image', kinds)],
    routedToImages: img.filter((r) => r.place !== 'text').length / Math.max(1, img.length),
    keepFailures: keepFailures(scoreArm('text-only', rows), scoreArm('image', rows)),
    keepFailuresByKind: Object.fromEntries(
      kinds.map((k) => [k, keepFailures(...kindPair(rows, k))]),
    ),
  }
}

const toTask = (t: unknown): Task => {
  const x = t as { id: string; questionType: string; input: { url: string; question: string } }
  const g = t as { gold: { answer: string }; aliases?: string[] }
  return {
    id: x.id,
    kind: x.questionType,
    url: x.input.url,
    question: x.input.question,
    gold: [g.gold.answer, ...(g.aliases ?? [])],
  }
}

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  yield* fs.makeDirectory(OUT, { recursive: true })
  const { tasks } = yield* loadSetFile(
    `${import.meta.dir}/../../bench/tasks`,
    'dev/pilot-images.jsonl',
  )
  const list = tasks.map(toTask)
  const pages = yield* Effect.forEach(
    list,
    (t) => fetchPage(t).pipe(Effect.orElseSucceed(() => EMPTY)),
    { concurrency: 4 },
  )
  const arms = ['text-only', 'image'] as const
  const jobs = Array.from({ length: runsArg }).flatMap(() =>
    list.flatMap((t, i) => arms.map((arm) => [t, pages[i] ?? EMPTY, arm] as const)),
  )
  const rows = yield* Effect.forEach(jobs, ([t, p, arm]) => Effect.option(armRow(t, p, arm)), {
    concurrency: 8,
  })
  const ok = rows.flatMap((r) => (r._tag === 'Some' ? [r.value] : []))
  yield* fs.writeFileString(`${OUT}/rows.json`, JSON.stringify(ok))
  yield* Effect.log(
    JSON.stringify({ rows: ok.length, failed: rows.length - ok.length, ...report(ok) }, null, 1),
  )
})

if (import.meta.main)
  program.pipe(
    Effect.provide(Layer.mergeAll(Jev.live, FetchHttpClient.layer, BunServices.layer)),
    BunRuntime.runMain,
  )
