// Wayback Machine fallback for dead pages (keyless archive.org availability
// API). Only a dead page falls back — a 404, 410, or 5xx, a network failure, or
// a timeout. A content-type refusal never does, and when the archive has no
// capture the original error stands.
import { Config, Effect, Schema } from 'effect'
import { asOfStamp } from '../lib/as-of.ts'
import { withJev } from '../lib/jev/budget.ts'
import { classifyHttpError } from '../lib/jev/fetch.ts'
import type { FetchError } from './decode.ts'
import { type FetchOptions, fetchText } from './http.ts'
import { HttpStatusError } from './http-body.ts'

const ARCHIVE_ORIGIN = 'https://archive.org'

interface ArchiveOptions extends FetchOptions {
  archiveOrigin?: string | undefined
}

type FetchFailure = HttpStatusError | FetchError

// A content-type refusal is a live page the caller cannot read, not a dead one.
const isDeadPage = (err: FetchFailure): boolean =>
  err instanceof HttpStatusError
    ? err.status === 404 || err.status === 410 || err.status >= 500
    : !/unsupported content-type|robots\.txt disallows/.test(err.message)

// The raw capture (no Wayback toolbar): `id_` after the timestamp, https for
// the real archive host.
export function rawCapture(captureUrl: string, timestamp: string): string {
  return captureUrl
    .replace(/^http:\/\/web\.archive\.org\//, 'https://web.archive.org/')
    .replace(`/web/${timestamp}/`, `/web/${timestamp}id_/`)
}

const Availability = Schema.fromJsonString(
  Schema.Struct({
    archived_snapshots: Schema.Struct({
      closest: Schema.optional(
        Schema.Struct({
          available: Schema.Boolean,
          status: Schema.String,
          url: Schema.String,
          timestamp: Schema.String,
        }),
      ),
    }),
  }),
)

// WEBULAR_SOURCE_ORIGIN, the knob every free source honors, points the lookup at
// a local fixture; an explicit archiveOrigin wins.
const archiveOrigin = (opts: ArchiveOptions) =>
  opts.archiveOrigin !== undefined
    ? Effect.succeed(opts.archiveOrigin)
    : Config.String('WEBULAR_SOURCE_ORIGIN').pipe(Config.withDefault(ARCHIVE_ORIGIN), Effect.orDie)

const closestCapture = (url: string, opts: ArchiveOptions = {}) =>
  archiveOrigin(opts).pipe(
    Effect.zipWith(asOfStamp, (origin, stamp) =>
      fetchText(
        `${origin}/wayback/available?url=${encodeURIComponent(url)}${stamp ? `&timestamp=${stamp}` : ''}`,
        opts,
      ),
    ),
    Effect.flatten,
    Effect.flatMap(Schema.decodeUnknownEffect(Availability)),
    Effect.map(({ archived_snapshots: { closest } }) =>
      closest?.available && /^2\d\d$/.test(closest.status)
        ? rawCapture(closest.url, closest.timestamp)
        : undefined,
    ),
  )

const fromArchive = (url: string, opts: ArchiveOptions, original: FetchFailure) =>
  closestCapture(url, opts).pipe(
    Effect.orElseSucceed(() => undefined),
    Effect.flatMap((capture) =>
      capture
        ? Effect.map(fetchText(capture, opts), (html) => ({
            html,
            archivedFrom: capture as string | undefined,
          }))
        : Effect.fail(original),
    ),
  )

// Jev (fetch.error) may send a live-looking failure such as a 403 to the archive
// too. Its baseline never picks try_archive for a status that is not dead, so with
// Jev off only dead pages fall back. ponytail: the error body is not kept, so Jev
// sees the status only; keep the body on HttpStatusError if picks need it.
const jevSaysArchive = (url: string, err: HttpStatusError, opts: ArchiveOptions) =>
  withJev(classifyHttpError({ url, status: err.status, body: '' }, opts.timeoutMs ?? 30_000))

export const fetchTextOrArchive = (url: string, opts: ArchiveOptions = {}) =>
  fetchText(url, opts).pipe(
    Effect.map((html) => ({ html, archivedFrom: undefined as string | undefined })),
    Effect.catch((err) =>
      isDeadPage(err)
        ? fromArchive(url, opts, err)
        : err instanceof HttpStatusError
          ? Effect.flatMap(jevSaysArchive(url, err, opts), (next) =>
              next === 'try_archive' ? fromArchive(url, opts, err) : Effect.fail(err),
            )
          : Effect.fail(err),
    ),
  )
