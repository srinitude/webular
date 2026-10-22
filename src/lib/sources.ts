// Bounded, index-ordered source fetching shared by answer/research: fetch each
// URL with host-sized concurrency, extract article text, keep successes in
// INPUT order and surface failures as attempt-ordered errors — never
// completion-ordered. Readability runs on at most maxHtml characters when the
// caller caps it (answer mode: it costs 1-3 s of CPU per ~1 MB page).
import { availableParallelism } from 'node:os'
import { Context, Effect, Exit, Layer, Ref, Semaphore } from 'effect'
import { z } from 'zod'
import { hostConcurrency } from '../core/budget.ts'
import { fetchText } from '../core/http.ts'
import { errMsg } from '../core/output.ts'
import { textAndImages } from './html.ts'
import type { PageImage } from './html-images.ts'
import { withArchiveCopy } from './sources/archive-copy.ts'

// The one zod mirror of the {url, reason} partial-failure shape — composed
// into every fan-out workflow's output schema so they cannot drift.
export const fetchErrorsSchema = z.array(z.object({ url: z.string(), reason: z.string() }))

// Readability runs in a lazy pool of Bun Workers so parses overlap each other
// and the fetches. A permit per worker is the bounded queue: callers wait on
// it, so no worker ever holds more than one message.
// ponytail: cap of 4 workers, HTML cloned per message, an interrupted parse
// kills its worker; raise PARSE_POOL_CAP or transfer bytes if parse CPU or
// copy cost still dominates.
const PARSE_POOL_CAP = 4
// Bun's Worker carries ref/unref; the DOM lib type in scope does not.
type BunWorker = Worker & { ref(): void; unref(): void }
interface PoolState {
  readonly idle: Ref.Ref<readonly BunWorker[]>
  readonly broken: Ref.Ref<boolean>
}

// From src this module sits in src/lib beside parse-worker.ts; built, it
// lands in a dist/chunks chunk and the worker in dist/lib/parse-worker.js.
const workerUrl = new URL(
  `../lib/parse-worker.${import.meta.url.endsWith('.ts') ? 'ts' : 'js'}`,
  import.meta.url,
).href

type Parsed = { readonly text: string; readonly images: PageImage[] }
const parseInThread = (html: string, base: string) =>
  Effect.try((): Parsed => textAndImages(html, base))

const takeWorker = ({ idle }: PoolState) =>
  Ref.modify(idle, (workers) => [workers.at(-1), workers.slice(0, -1)] as const).pipe(
    Effect.map((reused) => {
      const worker = reused ?? (new Worker(workerUrl) as BunWorker) // a missing file surfaces as onerror
      worker.ref() // a busy worker holds the CLI open until its reply lands
      return worker
    }),
  )

// A healthy reply (text or a parse error) returns the worker to the pool; a
// crash (`undefined`) or an interrupt terminates it, and a crash also turns
// the pool off for the rest of the pool's life.
const releaseWorker =
  ({ idle, broken }: PoolState) =>
  (worker: BunWorker, exit: Exit.Exit<Parsed | undefined, unknown>) => {
    const crashed = Exit.isSuccess(exit) && exit.value === undefined
    if (crashed || Exit.hasInterrupts(exit)) {
      return Effect.sync(() => worker.terminate()).pipe(
        Effect.andThen(crashed ? Ref.set(broken, true) : Effect.void),
      )
    }
    // idle workers never keep the process alive
    return Effect.sync(() => worker.unref()).pipe(
      Effect.andThen(Ref.update(idle, (workers) => [...workers, worker])),
    )
  }

const askWorker = (worker: BunWorker, html: string, base: string) =>
  Effect.callback<Parsed | undefined, unknown>((resume) => {
    worker.onmessage = (event: MessageEvent<{ parsed?: Parsed; error?: string }>) => {
      const { parsed, error } = event.data
      resume(
        error === undefined
          ? Effect.succeed(parsed ?? { text: '', images: [] })
          : Effect.fail(new Error(error)),
      )
    }
    worker.onerror = () => resume(Effect.succeed(undefined))
    worker.postMessage({ html, base })
  })

const parseInWorker = (state: PoolState, html: string, base: string) =>
  Effect.acquireUseRelease(
    takeWorker(state),
    (worker) => askWorker(worker, html, base),
    releaseWorker(state),
  ).pipe(Effect.flatMap((p) => (p === undefined ? parseInThread(html, base) : Effect.succeed(p))))

// The pool's permits and idle workers live as long as the runtime that builds
// this layer. Building it starts no worker; closing it, or `drain`, terminates
// the idle ones (a busy one is terminated by its interrupted parse). A drained
// pool stays usable: the next parse starts a fresh worker.
const terminateIdle = (idle: PoolState['idle']) =>
  Effect.flatMap(Ref.getAndSet(idle, []), (workers) =>
    Effect.forEach(workers, (worker) => Effect.sync(() => worker.terminate()), {
      concurrency: 1,
      discard: true,
    }),
  )

const makePool = Effect.gen(function* () {
  const permits = yield* Semaphore.make(Math.min(availableParallelism(), PARSE_POOL_CAP))
  const state: PoolState = {
    idle: yield* Effect.acquireRelease(Ref.make<readonly BunWorker[]>([]), terminateIdle),
    broken: yield* Ref.make(typeof Worker === 'undefined'),
  }
  const parse = (html: string, base: string) =>
    Effect.flatMap(Ref.get(state.broken), (broken) =>
      broken ? parseInThread(html, base) : permits.withPermit(parseInWorker(state, html, base)),
    )
  return { parse, drain: terminateIdle(state.idle) }
})

export class ParsePool extends Context.Service<
  ParsePool,
  {
    readonly parse: (html: string, base: string) => Effect.Effect<Parsed, unknown>
    readonly drain: Effect.Effect<void>
  }
>()('webular/lib/ParsePool') {
  static readonly layer = Layer.effect(ParsePool, makePool)
}

// Article text and images for one page, off the main thread when Workers run;
// an in-thread parse when they are missing or fail.
export const parseArticleText = (html: string, base = '') =>
  ParsePool.use((pool) => pool.parse(html, base))

interface SourceRef {
  title: string
  url: string
}

export interface SourceEntry {
  title: string
  url: string
  text: string
  images?: PageImage[] | undefined
}

interface FetchedSources {
  entries: SourceEntry[]
  errors: { url: string; reason: string }[]
}

type Outcome = { ok: true; entry: SourceEntry } | { ok: false; url: string; reason: string }

// Small batches parse in-thread: in a fresh CLI process a worker's startup
// (it loads Readability again) costs more than the overlap saves. Measured
// medians: 1 page 1958 ms in-thread vs 5870 ms pool, 3 pages 5002 vs 6088,
// 6 pages 6284 vs 2825.
// ponytail: fixed cut from one machine's medians; re-measure if parse cost moves.
const POOL_MIN_PAGES = 4
// A dead page (404, 410, 5xx, network failure, timeout) reads from the Internet
// Archive's closest capture, so one dead source does not drop out of an answer.
const fetchOne = (src: SourceRef, timeoutMs: number, maxHtml: number, pooled: boolean) =>
  withArchiveCopy(src.url, fetchText(src.url, { timeoutMs }), (capture) =>
    fetchText(capture, { timeoutMs }),
  ).pipe(
    Effect.flatMap(({ value: html }) =>
      (pooled ? parseArticleText : parseInThread)(html.slice(0, maxHtml), src.url),
    ),
    Effect.match({
      onSuccess: ({ text, images }): Outcome => ({
        ok: true,
        entry: { title: src.title, url: src.url, text, images },
      }),
      onFailure: (err): Outcome => ({ ok: false, url: src.url, reason: errMsg(err) }),
    }),
  )

export const fetchSources = Effect.fn('fetchSources')(function* (
  sources: SourceRef[],
  timeoutMs = 15_000,
  maxHtml = Number.POSITIVE_INFINITY,
) {
  const outcomes = yield* Effect.forEach(
    sources,
    (src) => fetchOne(src, timeoutMs, maxHtml, sources.length >= POOL_MIN_PAGES),
    {
      concurrency: yield* hostConcurrency,
    },
  )
  const out: FetchedSources = { entries: [], errors: [] }
  for (const outcome of outcomes) {
    if (outcome.ok) out.entries.push(outcome.entry)
    else out.errors.push({ url: outcome.url, reason: outcome.reason })
  }
  return out
})
