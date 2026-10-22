// Media job adapters: capture an image of a page. Firecrawl POST /v2/scrape with
// the `screenshot` format returns a hosted image URL; webular's media workflow
// writes a PNG file. An arm passes when it returns an image for the page, so
// each output carries an `image:` line only when one came back.
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Random, Schema } from 'effect'
import type { Output, Provider } from './model.ts'
import { fail, out, type Post } from './peers.ts'

// Firecrawl scrape: 1 credit at $83 / 100,000; the screenshot format adds none.
const FIRECRAWL_MEDIA_USD = 83 / 100_000
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]

type Jobs = Provider['jobs']
const FcShot = Schema.Struct({ data: Schema.Struct({ screenshot: Schema.String }) })

export const MediaOut = Schema.Struct({ savedTo: Schema.String, bytes: Schema.Number })

/** Workflow input: one screenshot to a fresh temp file. */
export const mediaInput = (url: string) =>
  Random.nextInt.pipe(
    Effect.map((n) => ({
      url,
      action: 'screenshot' as const,
      dest: join(tmpdir(), `webular-bench-${n}.png`),
    })),
  )

export const imageReturned = (
  ref: string,
  url: string,
  costUsd: number,
  sentBytes: number,
): Output => out(`image:${ref}`, [url], costUsd, sentBytes)

// webular: the saved file must be a PNG, so an empty or wrong file is no image.
export const savedImage = (r: typeof MediaOut.Type, url: string) =>
  Effect.tryPromise({
    try: () => Bun.file(r.savedTo).slice(0, PNG_MAGIC.length).bytes(),
    catch: fail,
  }).pipe(
    Effect.filterOrFail(
      (head) => r.bytes > 0 && PNG_MAGIC.every((b, i) => head[i] === b),
      () => fail(`no PNG at ${r.savedTo}`),
    ),
    Effect.map(() => imageReturned(`png ${r.bytes} bytes`, url, 0, 0)),
  )

export const firecrawlMedia = (post: Post, key: string): Jobs => ({
  media: ({ url = '' }) =>
    post(
      'https://api.firecrawl.dev/v2/scrape',
      { authorization: `Bearer ${key}` },
      { url, formats: ['screenshot'] },
      FcShot,
    ).pipe(
      Effect.map(({ r, sentBytes }) =>
        imageReturned(r.data.screenshot, url, FIRECRAWL_MEDIA_USD, sentBytes),
      ),
    ),
})
