// Word banks and page chrome for the home-made scrape snapshots. Every page is
// original text built from these banks, so no two pages share a body.
import { CANARY } from './generate-common'

export const DOMAINS = [
  'news',
  'tech',
  'retail',
  'science',
  'travel',
  'food',
  'finance',
  'health',
  'sports',
  'government',
] as const

const SUBJECTS = [
  'The river council',
  'A small bakery',
  'The night shift crew',
  'Our field team',
  'The city library',
  'A rural clinic',
  'The robotics club',
  'A ferry captain',
  'The orchard owners',
  'The weather office',
  'A chess teacher',
  'The harbor museum',
]
const VERBS = [
  'measured',
  'rebuilt',
  'documented',
  'tested',
  'mapped',
  'restored',
  'counted',
  'reviewed',
  'shipped',
  'planted',
  'repaired',
  'surveyed',
]
const OBJECTS = [
  'eleven copper valves',
  'the north footbridge',
  'a cedar greenhouse',
  'forty tide gauges',
  'the old signal tower',
  'a fleet of cargo bikes',
  'nine solar lanterns',
  'the granite steps',
  'a box of seed packets',
  'the winter timetable',
  'two brass telescopes',
  'a stack of field notes',
]
const PLACES = [
  'Larkspur Bay',
  'Copper Hollow',
  'East Ridge',
  'Millbrook',
  'Saltmarsh Point',
  'Fernvale',
  'Ironwood Flats',
  'Quarry Lane',
  'Harrow Glen',
  'Bluewater Cove',
  'Ashford Mills',
  'Pinecrest',
]
const NAMES = [
  'Mara Ellison',
  'Theo Varga',
  'Priya Nandakumar',
  'Jonah Reyes',
  'Ines Calder',
  'Felix Okafor',
  'Dana Whitlock',
  'Ravi Chen',
  'Lucia Moretti',
  'Sam Achterberg',
  'Noor Haddad',
  'Owen Lindqvist',
]

const pick = <A>(bank: ReadonlyArray<A>, n: number): A =>
  bank[((n % bank.length) + bank.length) % bank.length] as A

export const sentence = (seed: number, k: number) =>
  `${pick(SUBJECTS, seed + k)} ${pick(VERBS, seed * 3 + k)} ${pick(OBJECTS, seed * 5 + k * 7)} near ${pick(PLACES, seed * 7 + k * 3)} (note ${seed}-${k}).`

export const paragraphs = (seed: number, count: number) =>
  Array.from({ length: count }, (_, k) => [0, 1, 2].map((j) => sentence(seed, k * 3 + j)).join(' '))

export const byline = (seed: number) => pick(NAMES, seed * 5 + 1)
export const place = (seed: number) => pick(PLACES, seed)
export const date = (seed: number) =>
  `2026-${String((seed % 9) + 1).padStart(2, '0')}-${String((seed % 27) + 1).padStart(2, '0')}`
export const domainOf = (seed: number) => pick(DOMAINS, seed)

export const chrome = (seed: number) => ({
  nav: `Site menu: Home, Sections, Subscribe, Sign in (menu ${seed})`,
  cookie: `We use cookies to improve your visit. Accept all cookies (banner ${seed})`,
  footer: `Copyright Fixture Media Group, all rights reserved (footer ${seed})`,
  ad: `Sponsored: try QuickLoans Plus today (ad ${seed})`,
})

export const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

export interface Shell {
  readonly seed: number
  readonly title: string
  readonly author: string
  readonly published: string
  readonly lang: string
  readonly main: string
  readonly head?: string
  readonly tail?: string
}

// One page: the main block sits between nav, cookie banner, ad, and footer,
// which every task lists in gold.without.
export const page = (s: Shell) => {
  const c = chrome(s.seed)
  return `<!doctype html>
<!-- ${CANARY} -->
<html lang="${s.lang}"><head><meta charset="utf-8"><title>${escapeHtml(s.title)}</title>
<meta name="author" content="${escapeHtml(s.author)}"><meta property="article:published_time" content="${s.published}">${s.head ?? ''}</head>
<body><nav>${c.nav}</nav><div class="cookie-banner">${c.cookie}</div>
<main><h1>${escapeHtml(s.title)}</h1><p class="byline">By ${escapeHtml(s.author)}, <time datetime="${s.published}">${s.published}</time></p>
${s.main}</main>
<aside class="ad">${c.ad}</aside><footer>${c.footer}</footer>${s.tail ?? ''}</body></html>
`
}
