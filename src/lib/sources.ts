// Bounded, index-ordered source fetching shared by answer/research: fetch each
// URL under pLimit(4), extract article text, keep successes in INPUT order and
// surface failures as attempt-ordered errors — never completion-ordered.
import pLimit from 'p-limit'
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

async function fetchOne(src: SourceRef, timeoutMs: number): Promise<Outcome> {
  try {
    const text = htmlToArticle(await fetchText(src.url, { timeoutMs })).text || ''
    return { ok: true, entry: { title: src.title, url: src.url, text } }
  } catch (err) {
    return { ok: false, url: src.url, reason: errMsg(err) }
  }
}

export async function fetchSources(
  sources: SourceRef[],
  timeoutMs = 15_000,
): Promise<FetchedSources> {
  const pool = pLimit(4)
  const outcomes = await Promise.all(sources.map((src) => pool(() => fetchOne(src, timeoutMs))))
  const out: FetchedSources = { entries: [], errors: [] }
  for (const outcome of outcomes) {
    if (outcome.ok) out.entries.push(outcome.entry)
    else out.errors.push({ url: outcome.url, reason: outcome.reason })
  }
  return out
}
