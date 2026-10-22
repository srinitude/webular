// Fetch layer: one conditional GET per batch. 304 keeps the snapshot object as is: no
// download, no hash, no parse. A failed fetch falls back to the last verified snapshot
// and logs it.
import { Data, Effect } from 'effect'
import type * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientRequest from 'effect/http/HttpClientRequest'
import { collectCapped } from '../../core/capped-bytes.ts'
import { USER_AGENT } from '../../core/http.ts'
import { type DecisionModel, type DocsSnapshot, type Headers, prove } from './docs-snapshot.ts'

export class DocsRefused extends Data.TaggedError('DocsRefused')<{ readonly reason: string }> {}

interface Fetched extends Headers {
  readonly status: number
  readonly text: string
}
export type Fetcher = (url: string, cond: Headers) => Effect.Effect<Fetched, unknown>

// The docs are a few hundred lines; a body past this cap is refused, not buffered.
const DOCS_MAX_BYTES = 4 * 1024 * 1024

// Webular's fetch layer for Jev is effect/http HttpClient, the same one client.ts uses.
export const httpFetcher =
  (http: HttpClient.HttpClient, maxBytes = DOCS_MAX_BYTES): Fetcher =>
  (url, cond) =>
    Effect.gen(function* () {
      let req = HttpClientRequest.setHeader(HttpClientRequest.get(url), 'user-agent', USER_AGENT)
      if (cond.etag) req = HttpClientRequest.setHeader(req, 'If-None-Match', cond.etag)
      if (cond.lastModified)
        req = HttpClientRequest.setHeader(req, 'If-Modified-Since', cond.lastModified)
      const res = yield* http.execute(req)
      return {
        status: res.status,
        text:
          res.status === 200
            ? new TextDecoder().decode(
                yield* collectCapped(
                  res.stream,
                  maxBytes,
                  () => new Error(`docs response exceeded ${maxBytes} bytes`),
                ),
              )
            : '',
        etag: res.headers['etag'],
        lastModified: res.headers['last-modified'],
      }
    })

export interface GuardLog {
  readonly event: 'unchanged' | 'refreshed' | 'stale-used' | 'refused'
  readonly model: string
  readonly reason?: string
}
type Log = (l: GuardLog) => Effect.Effect<void>

const fallback = (
  model: DecisionModel,
  last: DocsSnapshot | undefined,
  log: Log,
  reason: string,
): Effect.Effect<DocsSnapshot, DocsRefused> =>
  last?.verified
    ? log({ event: 'stale-used', model: model.id, reason }).pipe(Effect.as(last))
    : log({ event: 'refused', model: model.id, reason }).pipe(
        Effect.andThen(Effect.fail(new DocsRefused({ reason: `${model.id}: ${reason}` }))),
      )

const answered = (
  model: DecisionModel,
  url: string,
  last: DocsSnapshot | undefined,
  log: Log,
  r: Fetched,
): Effect.Effect<DocsSnapshot, DocsRefused> => {
  const fail = (reason: string) => fallback(model, last, log, reason)
  if (r.status === 304 && last?.verified)
    return log({ event: 'unchanged', model: model.id }).pipe(Effect.as(last))
  if (r.status !== 200) return fail(`docs answered HTTP ${r.status}`)
  const snap = prove(model.id, url, r.text, r)
  return snap === undefined
    ? fail('docs no longer state every limit')
    : log({ event: 'refreshed', model: model.id }).pipe(Effect.as(snap))
}

export const refresh = (
  model: DecisionModel,
  last: DocsSnapshot | undefined,
  get: Fetcher,
  log: Log,
): Effect.Effect<DocsSnapshot, DocsRefused> => {
  const url = model.docs
  if (url === undefined) return fallback(model, last, log, 'no docs registered')
  return get(url, { etag: last?.etag, lastModified: last?.lastModified }).pipe(
    Effect.matchEffect({
      onFailure: (e) => fallback(model, last, log, `docs unreachable: ${String(e)}`),
      onSuccess: (r) => answered(model, url, last, log, r),
    }),
  )
}
