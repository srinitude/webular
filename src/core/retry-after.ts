// One reader for `Retry-After` and `x-ratelimit-reset`-style delay headers: plain
// decimal seconds, or an HTTP-date, which is always GMT (the asctime form omits
// the zone, and Date.parse would read it in the machine's zone). Hex, exponent,
// "1,5", and loose strings that Date.parse guesses at are not delays.
const SECONDS = /^\d+(\.\d+)?$/
const HAS_ZONE = /(GMT|UTC|Z|[+-]\d{2}:?\d{2})$/i
const DATE_SHAPE = /^(?=.*[a-z]{3})(?=.*\d{4})(?=.*\d{2}:\d{2})/i

/** Milliseconds from `now` until the header's moment, never negative; undefined when unreadable. */
export const delayHeaderMs = (
  header: string | null | undefined,
  now: number,
): number | undefined => {
  const value = header?.trim()
  if (!value) return undefined
  if (SECONDS.test(value)) return Number(value) * 1000
  if (!DATE_SHAPE.test(value)) return undefined
  const at = Date.parse(HAS_ZONE.test(value) ? value : `${value} GMT`)
  return Number.isNaN(at) ? undefined : Math.max(0, at - now)
}
