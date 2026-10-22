// Rank merged free-source hits by how far each one can be believed, not by
// which source happened to answer first: score = trust x recency (2610.11932).
// A hit with no `published` date scores as one half-life of age.
import { parseUtc } from '../../core/utc-date.ts'
import type { Hit } from './polite.ts'

// Recency halves every half-life; the query's class picks it (2603.16544):
// fresh asks ("latest", "price") decay in a month, history asks in ten years.
const FRESH = /\b(latest|newest|today|now|current(ly)?|price|news|this (week|month|year))\b/i
const HISTORY = /\b(history|historical|origins?|invented|founded|originally)\b/i
const halfLifeDays = (query: string) => (FRESH.test(query) ? 30 : HISTORY.test(query) ? 3650 : 365)
const DAY_MS = 86_400_000
// Trust for a hit no source stamped: below every listed source.
const UNKNOWN_TRUST = 0.1

// A named year window ("in 2024", "before 2019", "since 2020"): a dated hit
// outside it scores zero; an undated hit stays, since its year is unknown.
// ponytail: years only; month and relative windows ("since March") pass through.
const WINDOW = /\b(in|during|before|after|since|until)\s+((?:19|20)\d{2})\b/i
const FITS: Record<string, (year: number, y: number) => boolean> = {
  before: (year, y) => year < y,
  until: (year, y) => year <= y,
  after: (year, y) => year > y,
  since: (year, y) => year >= y,
}
const inWindow = (query: string) => {
  const m = WINDOW.exec(query)
  if (!m) return () => true
  const y = Number(m[2])
  const fits = FITS[(m[1] as string).toLowerCase()] ?? ((year: number) => year === y)
  return (year: number) => fits(year, y)
}

const score = (hit: Hit, now: number, half: number, fits: (year: number) => boolean) => {
  const at = hit.published ? parseUtc(hit.published) : Number.NaN
  const dated = !Number.isNaN(at)
  if (dated && !fits(new Date(at).getUTCFullYear())) return 0
  const days = dated ? Math.max(0, (now - at) / DAY_MS) : half
  return (hit.trust ?? UNKNOWN_TRUST) * 0.5 ** (days / half)
}

// Highest score first; ties keep their input order (Array.sort is stable).
export const rankHits = (hits: ReadonlyArray<Hit>, now: number, query = ''): Hit[] => {
  const half = halfLifeDays(query)
  const fits = inWindow(query)
  return hits
    .map((hit) => ({ hit, s: score(hit, now, half, fits) }))
    .sort((a, b) => b.s - a.s)
    .map(({ hit }) => hit)
}
