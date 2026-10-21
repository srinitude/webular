// Bounded, index-ordered source fetching shared by answer/research: fetch each
// URL with concurrency 4, extract article text, keep successes in INPUT order
// and surface failures as attempt-ordered errors — never completion-ordered.
import { Effect } from 'effect'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { errMsg } from '../core/output.ts'
import { htmlToArticle } from './html.ts'

// The one zod mirror of the {url, reason} partial-failure shape — composed
// into every fan-out workflow's output schema so they cannot drift.
export const fetchErrorsSchema = z.array(z.object({ url: z.string(), reason: z.string() }))

interface SourceRef {
  title: string
  url: string
}

export interface SourceEntry {
  title: string
  url: string
  text: string
}

interface FetchedSources {
  entries: SourceEntry[]
  errors: { url: string; reason: string }[]
}

type Outcome = { ok: true; entry: SourceEntry } | { ok: false; url: string; reason: string }

function fetchOne(src: SourceRef, timeoutMs: number): Effect.Effect<Outcome> {
  return fetchText(src.url, { timeoutMs }).pipe(
    Effect.map((html): Outcome => {
      const text = htmlToArticle(html).text || ''
      return { ok: true, entry: { title: src.title, url: src.url, text } }
    }),
    Effect.catch((err) =>
      Effect.succeed<Outcome>({ ok: false, url: src.url, reason: errMsg(err) }),
    ),
  )
}

export const fetchSources = Effect.fn('fetchSources')(function* (
  sources: SourceRef[],
  timeoutMs = 15_000,
) {
  const outcomes = yield* Effect.forEach(sources, (src) => fetchOne(src, timeoutMs), {
    concurrency: 4,
  })
  const out: FetchedSources = { entries: [], errors: [] }
  for (const outcome of outcomes) {
    if (outcome.ok) out.entries.push(outcome.entry)
    else out.errors.push({ url: outcome.url, reason: outcome.reason })
  }
  return out
})
