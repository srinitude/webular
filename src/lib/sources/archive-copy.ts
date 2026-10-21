// A keyless archive copy for commands that fetch a user-given URL: when the
// live fetch fails the way a dead page does (404, 410, 5xx, a network failure,
// a timeout), the Internet Archive's closest 2xx capture is fetched instead,
// as the raw `id_` bytes. Content-type and size refusals never fall back. When
// both fail, one ArchiveCopyError names the URL and both reasons.
import { Data, Effect } from 'effect'
import { rawCapture } from '../../core/archive.ts'
import { HttpStatusError } from '../../core/http-body.ts'
import { errMsg } from '../../core/output.ts'
import { waybackAvailable } from './archives.ts'

export class ArchiveCopyError extends Data.TaggedError('ArchiveCopyError')<{
  readonly message: string
}> {}

// A refusal is a live page the caller cannot take, not a dead one; 4xx other
// than 404 and 410 (in a download's message) is the live host saying no.
const REFUSAL = /unsupported content-type|max \d+ bytes|failed: 4(?!04|10)\d\d/

const isDeadPage = (err: unknown): boolean =>
  err instanceof HttpStatusError
    ? err.status === 404 || err.status === 410 || err.status >= 500
    : !REFUSAL.test(errMsg(err))

// description is `<timestamp> HTTP <status>`.
const captureOf = (url: string) =>
  Effect.flatMap(waybackAvailable(url, 1), ([hit]) => {
    const found = /^(\d+) HTTP 2\d\d$/.exec(hit?.description ?? '')
    return found && hit
      ? Effect.succeed(rawCapture(hit.url, found[1] ?? ''))
      : Effect.fail(new Error('the archive has no capture'))
  })

const bothFailed = (url: string, live: unknown, archive: unknown) =>
  new ArchiveCopyError({
    message: `${url}: the live fetch failed (${errMsg(live)}) and the archive copy failed (${errMsg(archive)})`,
  })

// Run `live`; on a dead-page failure run `fromCapture` on the archive's capture
// URL. `archivedFrom` is that capture URL, absent when the live fetch served.
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
