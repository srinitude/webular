// Reading a fetched response as text: the non-2xx error, the textual-content
// guard, the size cap, and body release. Split from http.ts, which drives the
// requests.
import { Data, Effect } from 'effect'
import { FetchError, readTextCapped } from './decode.ts'
import { FETCH_ERROR } from './fetch-policy.ts'

const MAX_TEXT_BYTES = 25 * 1024 * 1024

// MIME types accepted by text fetches; anything else errors instead of
// decoding binary bytes into garbage markdown.
const TEXTUAL_MIMES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  'application/xhtml+xml',
])

// A non-2xx response, typed so callers branch on the status, not the message.
// The message is an own field, not a getter: Mastra copies a step error's own
// fields, so a prototype getter reaches the CLI as "failed (undefined)".
export class HttpStatusError extends Data.TaggedError('HttpStatusError')<{
  url: string
  status: number
  statusText: string
}> {
  override message = FETCH_ERROR.httpFailed(this.url, this.status, this.statusText)
}

// Release an unread body so the pooled connection is freed at once instead of
// waiting for GC (Bun guide BUN027). A stream already locked by its reader was
// cancelled by that reader, so a failed cancel is ignored.
export const dropBody = (res: Response) =>
  Effect.ignore(
    Effect.tryPromise({ try: () => res.body?.cancel() ?? Promise.resolve(), catch: (err) => err }),
  )

// The refused MIME type, or undefined when the body is text.
function refusedMime(res: Response): string | undefined {
  const header = res.headers.get('content-type')
  if (!header) return undefined
  const mime = (header.split(';')[0] ?? '').trim().toLowerCase()
  const ok =
    mime === '' ||
    mime.startsWith('text/') ||
    mime.endsWith('+xml') ||
    mime.endsWith('+json') ||
    TEXTUAL_MIMES.has(mime)
  return ok ? undefined : mime
}

const readOk = Effect.fn('readOk')(function* (res: Response, url: string, max = MAX_TEXT_BYTES) {
  if (!res.ok)
    return yield* new HttpStatusError({ url, status: res.status, statusText: res.statusText })
  const bad = refusedMime(res)
  if (bad !== undefined)
    return yield* new FetchError({
      message: `fetch ${url}: unsupported content-type "${bad}" — use media --download`,
    })
  return yield* readTextCapped(res, url, max)
})

// Every rejected response releases its body.
export const okText = (res: Response, url: string, maxBytes?: number) =>
  readOk(res, url, maxBytes).pipe(Effect.tapError(() => dropBody(res)))
