// The built bundle (mise run build) can start the Readability parse worker.
// It reads the Worker URL expression from the dist chunk that holds it,
// resolves it against that chunk's own URL, starts the Worker, and expects
// article text back. A worker that cannot start would make the answer path
// fall back to in-thread parsing without a word.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem } from 'effect'

const chunks = new URL('../../dist/chunks/', import.meta.url)
const html = `<!doctype html><html><body><article><h1>Dist</h1>${'<p>Dist worker prose that Readability keeps.</p>'.repeat(20)}</article></body></html>`

const reply = (url: string) =>
  Effect.callback<string>((resume) => {
    const worker = new Worker(url)
    worker.onmessage = (event: MessageEvent<{ parsed?: { text: string }; error?: string }>) =>
      resume(Effect.succeed(`started: ${event.data.parsed?.text ?? `error ${event.data.error}`}`))
    worker.onerror = (event) => resume(Effect.succeed(`fallback: ${event.message}`))
    worker.postMessage({ html, base: '' })
    return Effect.sync(() => worker.terminate())
  }).pipe(Effect.timeout('10 seconds'))

// The parse-worker URL expression, inline in `new Worker(...)` or bound first.
const workerExpr = /(new URL\([^;]*?parse-worker[^;]*?,import\.meta\.url\))/

test(
  'dist resolves and starts the parse worker',
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const names = yield* fs.readDirectory(fileURLToPath(chunks))
        const sources = yield* Effect.forEach(
          names,
          (name) =>
            fs
              .readFileString(fileURLToPath(new URL(name, chunks)))
              .pipe(Effect.map((src) => ({ name, src }))),
          { concurrency: 4 },
        )
        const hit = sources.find(({ src }) => workerExpr.test(src))
        const expr = hit?.src.match(workerExpr)?.[1]
        expect(expr).toBeDefined()
        const chunk = new URL(hit?.name ?? '', chunks).href
        const workerUrl = new Function(
          'meta',
          `return ${expr?.replaceAll('import.meta.url', 'meta')}`,
        )(chunk) as URL
        const out = yield* reply(workerUrl.href)
        yield* Console.log(
          `parse-worker url from dist: ${workerUrl.href}\nparse-worker ${out.slice(0, 50)}`,
        )
        expect(out).toStartWith('started: ')
      }).pipe(Effect.provide(BunServices.layer)),
    ),
  15_000,
)
