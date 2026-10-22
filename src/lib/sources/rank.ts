// Rank merged free-source hits by how far each one can be believed, not by
// which source happened to answer first: score = trust x recency (2610.11932).
// A hit with no `published` date scores as one half-life of age.
import { parseUtc } from '../../core/utc-date.ts'
import type { Hit } from './polite.ts'

// Recency halves for every 365 days of age.
const HALF_LIFE_DAYS = 365
const DAY_MS = 86_400_000
// Trust for a hit no source stamped: below every listed source.
const UNKNOWN_TRUST = 0.1

const recency = (published: string | undefined, now: number) => {
  const at = published ? parseUtc(published) : Number.NaN
  const days = Number.isNaN(at) ? HALF_LIFE_DAYS : Math.max(0, (now - at) / DAY_MS)
  return 0.5 ** (days / HALF_LIFE_DAYS)
}

const score = (hit: Hit, now: number) => (hit.trust ?? UNKNOWN_TRUST) * recency(hit.published, now)

// Highest score first; ties keep their input order (Array.sort is stable).
export const rankHits = (hits: ReadonlyArray<Hit>, now: number): Hit[] =>
  hits
    .map((hit) => ({ hit, s: score(hit, now) }))
    .sort((a, b) => b.s - a.s)
    .map(({ hit }) => hit)
