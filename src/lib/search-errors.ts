// A search that found nothing because its sources failed is a failure, not an
// empty answer: each failed source rides in the payload's `errors` as {url, reason}.
import type { SourceStatus } from './search-source-run.ts'

interface SearchMetaLike {
  readonly sources: Readonly<Record<string, { readonly status: SourceStatus }>>
}

export const searchErrors = (
  found: { readonly results: ReadonlyArray<unknown>; readonly meta: SearchMetaLike } | undefined,
): Array<{ url: string; reason: string }> =>
  !found || found.results.length > 0
    ? []
    : Object.entries(found.meta.sources)
        .filter(([, s]) => s.status !== 'ok' && s.status !== 'no-results')
        .map(([source, s]) => ({ url: source, reason: `search source ${s.status}` }))
