// Wayback Machine fallback for dead pages (keyless archive.org availability
// API). Only a dead page falls back — a 404, 410, or 5xx, a network failure, or
// a timeout. A content-type refusal never does, and when the archive has no
// capture the original error stands.
import { Effect, Schema } from 'effect'
import type { FetchError } from './decode.ts'
import { type FetchOptions, fetchText, HttpStatusError } from './http.ts'

const ARCHIVE_ORIGIN = 'https://archive.org'

interface ArchiveOptions extends FetchOptions {
  archiveOrigin?: string
}

type FetchFailure = HttpStatusError | FetchError

// A content-type refusal is a live page the caller cannot read, not a dead one.
const isDeadPage = (err: FetchFailure): boolean =>
  err instanceof HttpStatusError
    ? err.status === 404 || err.status === 410 || err.status >= 500
    : !/unsupported content-type/.test(err.message)

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

const closestCapture = (url: string, opts: ArchiveOptions = {}) =>
  fetchText(
    `${opts.archiveOrigin ?? ARCHIVE_ORIGIN}/wayback/available?url=${encodeURIComponent(url)}`,
    opts,
  ).pipe(
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

export const fetchTextOrArchive = (url: string, opts: ArchiveOptions = {}) =>
  fetchText(url, opts).pipe(
    Effect.map((html) => ({ html, archivedFrom: undefined as string | undefined })),
    Effect.catch((err) => (isDeadPage(err) ? fromArchive(url, opts, err) : Effect.fail(err))),
  )
