// One disk cache entry and its HTTP freshness: what a 200 stores, how long it
// may be reused unrequested, and how a 304 freshens the stored copy.
import { Schema } from 'effect'
import { parseUtc } from './utc-date.ts'

export const Entry = Schema.Struct({
  body: Schema.String,
  etag: Schema.NullOr(Schema.String),
  lastModified: Schema.NullOr(Schema.String),
  contentType: Schema.NullOr(Schema.String),
  freshUntil: Schema.optional(Schema.Number),
})
export type Entry = typeof Entry.Type

// Epoch ms until which a response may be reused unrequested: max-age wins over
// Expires, and no-cache (or no usable header) means revalidate every time.
const freshUntil = (h: Headers, now: number): number | undefined => {
  const control = h.get('cache-control') ?? ''
  if (/\bno-cache\b/i.test(control)) return undefined
  const age = /\bmax-age=(\d+)/i.exec(control)?.[1]
  // The Age header is time the response already spent in upstream caches.
  if (age !== undefined) return now + (Number(age) - (Number(h.get('age')) || 0)) * 1000
  const expires = parseUtc(h.get('expires') ?? '')
  return Number.isNaN(expires) ? undefined : expires
}

export const toEntry = (body: string, h: Headers, now: number): Entry => ({
  body,
  freshUntil: freshUntil(h, now),
  etag: h.get('etag'),
  lastModified: h.get('last-modified'),
  contentType: h.get('content-type'),
})

// A 304 freshens the stored entry: its freshness and validators replace the stored ones.
export const freshen = (entry: Entry, h: Headers, now: number): Entry => ({
  ...entry,
  freshUntil: freshUntil(h, now),
  etag: h.get('etag') ?? entry.etag,
  lastModified: h.get('last-modified') ?? entry.lastModified,
})
