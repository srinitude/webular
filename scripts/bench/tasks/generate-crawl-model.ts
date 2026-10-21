// Site model for the crawl.map family. Gold comes only from this model, never
// from crawling. Gold rule: canonical, in-scope pages a correct crawler finds
// from startPath within the limits, through links or the sitemap. Left out:
// meta-refresh redirect sources, ?query duplicates, robots-disallowed pages,
// pages linked only from JS, and orphans not listed in a sitemap.
export type Size = 'small' | 'medium' | 'large'
export type Scope = 'none' | 'prefix' | 'depth' | 'pattern'

export interface Limits {
  readonly pathPrefix?: string
  readonly maxDepth?: number
  readonly include?: ReadonlyArray<string>
  readonly exclude?: ReadonlyArray<string>
}

export interface Page {
  readonly path: string
  readonly title: string
  readonly links: ReadonlyArray<string>
}

export interface Site {
  readonly name: string
  readonly domain: string
  readonly language: string
  readonly size: Size
  readonly sitemap: boolean
  readonly scope: Scope
  readonly limits: Limits
  readonly pages: ReadonlyArray<Page>
  readonly sitemapPaths: ReadonlyArray<string>
  readonly gold: ReadonlyArray<string>
}

const DOMAINS = [
  'science',
  'health',
  'law',
  'finance',
  'software',
  'sports',
  'culture',
  'local-government',
  'education',
  'travel',
] as const
const LANGS = ['en', 'en', 'de', 'en', 'ja', 'en', 'es', 'ko', 'en', 'zh'] as const
const WORD: Record<string, string> = {
  en: 'Page',
  de: 'Seite',
  ja: 'ページ',
  es: 'Página',
  ko: '페이지',
  zh: '页面',
}
const SCOPES: ReadonlyArray<Scope> = [
  'none',
  'prefix',
  'depth',
  'pattern',
  'none',
  'prefix',
  'depth',
  'pattern',
  'prefix',
  'pattern',
]
const SECTIONS = ['a', 'b', 'c'] as const
const SIZES: ReadonlyArray<Size> = ['small', 'medium', 'large']

// Page counts: small 20..47, medium 100..433, large 600..1473 (all under the cap).
const count = (size: Size, k: number) =>
  size === 'small' ? 20 + ((k * 3) % 28) : size === 'medium' ? 100 + k * 37 : 600 + k * 97

const limitsFor = (scope: Scope): Limits =>
  scope === 'prefix'
    ? { pathPrefix: '/b/' }
    : scope === 'depth'
      ? { maxDepth: 2 }
      : scope === 'pattern'
        ? { include: ['^/a/', '^/c/'], exclude: ['5\\.html$'] }
        : {}

// Ternary tree: page 0 is /index.html, pages 1..3 open sections a, b, c, and
// every later page sits in its parent's section.
const pathOf = (i: number, sec: ReadonlyArray<number>) =>
  i === 0 ? '/index.html' : `/${SECTIONS[sec[i] ?? 0]}/p${i}.html`

export const EXTRA = {
  orphan: '/orphan.html',
  redirect: '/old-home.html',
  private: '/private/staff.html',
  jsOnly: '/js/hidden.html',
} as const

const inScope = (path: string, l: Limits) =>
  (l.pathPrefix === undefined || path.startsWith(l.pathPrefix)) &&
  (l.include === undefined || l.include.some((r) => new RegExp(r).test(path))) &&
  !(l.exclude ?? []).some((r) => new RegExp(r).test(path))

const pagesFor = (n: number, language: string): Page[] => {
  const sec: number[] = [0]
  for (let i = 1; i < n; i++) sec.push(i <= 3 ? i - 1 : (sec[Math.floor((i - 1) / 3)] ?? 0))
  return Array.from({ length: n }, (_, i) => {
    const kids = [1, 2, 3].map((d) => 3 * i + d).filter((c) => c < n)
    const links = kids.map((c) => pathOf(c, sec))
    return { path: pathOf(i, sec), title: `${WORD[language]} ${i}`, links }
  })
}

// BFS from startPath over canonical links; depth counts link hops.
const reachable = (pages: ReadonlyArray<Page>, maxDepth = Number.POSITIVE_INFINITY) => {
  const children = new Map(pages.map((p) => [p.path, p.links]))
  const depth = new Map<string, number>([['/index.html', 0]])
  const queue = ['/index.html']
  for (let q = 0; q < queue.length; q++) {
    const at = queue[q] ?? ''
    const d = depth.get(at) ?? 0
    const next = d < maxDepth ? (children.get(at) ?? []) : []
    for (const c of next.filter((x) => !depth.has(x))) {
      depth.set(c, d + 1)
      queue.push(c)
    }
  }
  return [...depth.keys()]
}

const buildSite = (size: Size, k: number): Site => {
  const idx = SIZES.indexOf(size) * 10 + k
  const domain = DOMAINS[idx % DOMAINS.length] ?? 'science'
  const language = LANGS[(idx * 7) % LANGS.length] ?? 'en'
  const scope = SCOPES[k] ?? 'none'
  const sitemap = scope !== 'depth' && k % 2 === 0
  const pages = pagesFor(count(size, k), language)
  const sitemapPaths = sitemap ? [...pages.map((p) => p.path), EXTRA.orphan] : []
  const limits = limitsFor(scope)
  const found = new Set([...reachable(pages, limits.maxDepth), ...sitemapPaths])
  // robots.txt (sitemap sites only) blocks EXTRA.private, which is never in pages.
  const gold = [...found].filter((p) => inScope(p, limits)).sort()
  return {
    name: `${size}-${String(k).padStart(2, '0')}-${domain}`,
    domain,
    language,
    size,
    sitemap,
    scope,
    limits,
    pages,
    sitemapPaths,
    gold,
  }
}

export const SITES: ReadonlyArray<Site> = SIZES.flatMap((size) =>
  Array.from({ length: 10 }, (_, k) => buildSite(size, k)),
)
