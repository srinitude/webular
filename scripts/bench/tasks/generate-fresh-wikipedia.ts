// search.fresh tasks from Wikipedia new pages (the `list=recentchanges&rctype=new`
// API) in six non-English editions. Gold is the article created inside the
// window; the query is its lead sentence with the title removed.
import { Console, Effect, Schema } from 'effect'
import { AUTHOR, BUILD_DATE, CANARY, type Task } from './generate-common.ts'
import { EXPIRES, getJson, inWindow } from './generate-fresh-http.ts'

const LANGS = ['zh', 'ko', 'ja', 'de', 'fr', 'es'] as const
const PER_LANG = 4

const Changes = Schema.Struct({
  query: Schema.Struct({
    recentchanges: Schema.Array(Schema.Struct({ title: Schema.String, timestamp: Schema.String })),
  }),
})
const Extracts = Schema.Struct({
  query: Schema.Struct({
    pages: Schema.Record(
      Schema.String,
      Schema.Struct({
        title: Schema.String,
        extract: Schema.optional(Schema.String),
        pageprops: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
      }),
    ),
  }),
})

const api = (lang: string, params: string) =>
  `https://${lang}.wikipedia.org/w/api.php?format=json&${params}`

const lead = (extract: string, title: string) =>
  (extract.split(/(?<=[.。!?！？])\s*/)[0] ?? '')
    .replaceAll(title, '')
    .replace(/[(（][^)）]*[)）]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)

const toTask = (lang: string, title: string, created: string, query: string): Task => {
  const url = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`
  return {
    id: `fresh-search-wiki-${lang}-${Bun.hash(title).toString(16)}`,
    family: 'search',
    input: { query, subtype: 'search.fresh' },
    gold: { url, title, createdAt: created },
    aliases: [url, `https://${lang}.wikipedia.org/wiki/${title.replaceAll(' ', '_')}`, title],
    source: { url, asOf: created, license: 'CC BY-SA 4.0' },
    author: AUTHOR,
    buildDate: BUILD_DATE,
    questionType: 'navigational',
    tags: {
      domain: 'encyclopedia',
      language: lang,
      fresh: true,
      longTail: true,
      expires: EXPIRES,
      subtype: 'search.fresh',
    },
    canary: CANARY,
  }
}

// Pages created from 2026-09-20 on had weeks to be deleted as spam first.
const edition = (lang: (typeof LANGS)[number]) =>
  Effect.gen(function* () {
    const rc = yield* getJson(
      api(
        lang,
        'action=query&list=recentchanges&rctype=new&rcnamespace=0&rcshow=!redirect|!bot&rcdir=newer&rcstart=2026-09-20T00:00:00Z&rclimit=20&rcprop=title|timestamp',
      ),
      Changes,
    )
    const fresh = rc.query.recentchanges.filter((c) => inWindow(c.timestamp))
    const created = new Map(fresh.map((c) => [c.title, c.timestamp]))
    const titles = fresh.map((c) => encodeURIComponent(c.title)).join('|')
    const ex = yield* getJson(
      api(
        lang,
        `action=query&prop=extracts|pageprops&exintro=1&explaintext=1&exlimit=20&titles=${titles}`,
      ),
      Extracts,
    )
    return Object.values(ex.query.pages)
      .filter((p) => p.pageprops?.['disambiguation'] === undefined && created.has(p.title))
      .map((p) => ({ p, q: lead(p.extract ?? '', p.title) }))
      .filter(({ q }) => q.length >= 15)
      .sort((a, b) => a.p.title.localeCompare(b.p.title))
      .slice(0, PER_LANG)
      .map(({ p, q }) => toTask(lang, p.title, created.get(p.title) ?? '', q))
  })

const safeEdition = (lang: (typeof LANGS)[number]) =>
  edition(lang).pipe(
    Effect.catch((e) =>
      Console.error(`wikipedia ${lang} dropped: ${String(e).slice(0, 120)}`).pipe(
        Effect.as([] as Task[]),
      ),
    ),
  )

export const wikipediaTasks = Effect.forEach(LANGS, safeEdition, { concurrency: 2 }).pipe(
  Effect.map((x) => x.flat()),
)
