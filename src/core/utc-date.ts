// Date.parse reads a time with no zone as local time. HTTP and feed dates
// carry no local meaning: a time with no zone is GMT/UTC, on every machine.
const HAS_TIME = /\d:\d\d/
const HAS_ZONE = /(?:[a-z]{1,4}|[+-]\d{2}:?\d{2})\s*$/i

export const parseUtc = (value: string): number => {
  const text = value.trim()
  if (!HAS_TIME.test(text) || HAS_ZONE.test(text)) return Date.parse(text)
  return Date.parse(text.includes('T') ? `${text}Z` : `${text} GMT`)
}
