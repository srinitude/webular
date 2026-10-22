// A keyless archive copy for commands that fetch a user-given URL: when the
// live fetch fails the way a dead page does (404, 410, 5xx, a network failure,
// a timeout), the Internet Archive's closest 2xx capture is fetched instead,
// as the raw `id_` bytes. Content-type and size refusals never fall back. When
// both fail, one ArchiveCopyError names the URL and both reasons.
import { Data, Effect } from 'effect'
import { rawCapture } from '../../core/archive.ts'
import { HttpStatusError } from '../../core/http-body.ts'
import { errMsg } from '../../core/output.ts'
import { waybackAvailable, waybackCdx } from './archives.ts'
import type { Hit } from './polite.ts'

export class ArchiveCopyError extends Data.TaggedError('ArchiveCopyError')<{
  readonly message: string
}> {}

// A refusal is a live page the caller cannot take, not a dead one; 4xx other
// than 404 and 410 (in a download's message) is the live host saying no.
const REFUSAL =
  /unsupported content-type|max \d+ bytes|failed: 4(?!04|10)\d\d|robots\.txt disallows/

const isDeadPage = (err: unknown): boolean =>
  err instanceof HttpStatusError
    ? err.status === 404 || err.status === 410 || err.status >= 500
    : !REFUSAL.test(errMsg(err))

// description is `<timestamp> HTTP <status>` (availability) or
// `<timestamp> <mime> HTTP <status>` (CDX).
const CDX_ROWS = 5
const OK_CAPTURE = /^(\d+) (?:\S+ )?HTTP 2\d\d$/

const firstCapture =
  (lookup: (url: string, limit: number) => Effect.Effect<Hit[], unknown>) => (url: string) =>
    Effect.flatMap(lookup(url, CDX_ROWS), (hits) => {
      for (const hit of hits) {
        const ts = OK_CAPTURE.exec(hit.description)?.[1]
        if (ts) return Effect.succeed(rawCapture(hit.url, ts))
      }
      return Effect.fail(new Error('the archive has no capture'))
    })

// The availability API first; when it has nothing or fails, the Wayback CDX
// index. ponytail: the CDX lists oldest first, so its pick is the oldest 2xx
// capture of five; ask with a negative limit when a newer copy matters.
const captureOf = (url: string) =>
  firstCapture(waybackAvailable)(url).pipe(
    Effect.catch((first) => firstCapture(waybackCdx)(url).pipe(Effect.mapError(() => first))),
  )

const bothFailed = (url: string, live: unknown, archive: unknown) =>
  new ArchiveCopyError({
    message: `${url}: the live fetch failed (${errMsg(live)}) and the archive copy failed (${errMsg(archive)})`,
  })

// Run `live`; on a dead-page failure run `fromCapture` on the archive's capture
// URL. `archivedFrom` is that capture URL, absent when the live fetch served.
// The capture comes from the availability API, then the CDX index.
export const withArchiveCopy = <A, E, R>(
  url: string,
  live: Effect.Effect<A, E, R>,
  fromCapture: (captureUrl: string) => Effect.Effect<A, unknown, R>,
): Effect.Effect<{ value: A; archivedFrom?: string }, E | ArchiveCopyError, R> => {
  const viaArchive = (
    err: E,
  ): Effect.Effect<{ value: A; archivedFrom?: string }, E | ArchiveCopyError, R> =>
    isDeadPage(err)
      ? captureOf(url).pipe(
          Effect.flatMap((archivedFrom) =>
            Effect.map(fromCapture(archivedFrom), (value) => ({ value, archivedFrom })),
          ),
          Effect.mapError((archive) => bothFailed(url, err, archive)),
        )
      : Effect.fail(err)
  return live.pipe(
    Effect.map((value): { value: A; archivedFrom?: string } => ({ value })),
    Effect.catch(viaArchive),
  )
}
