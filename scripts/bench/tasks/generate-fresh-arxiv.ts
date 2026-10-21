// search.fresh tasks from arXiv listings (export.arxiv.org API, one request
// every 3 seconds). Gold is the versionless abs page of a paper submitted
// inside the 90-day window; the query is the abstract's first sentence.
import { Console, Effect, Schedule } from 'effect'
import { AUTHOR, BUILD_DATE, CANARY, type Task } from './generate-common.ts'
import { EXPIRES, getText, inWindow } from './generate-fresh-http.ts'

// arXiv category -> benchmark domain.
const CATEGORIES: ReadonlyArray<readonly [string, string]> = [
  ['astro-ph.GA', 'science'],
  ['cs.SE', 'software'],
  ['q-fin.ST', 'finance'],
  ['q-bio.QM', 'health'],
  ['math.CO', 'math'],
  ['econ.GN', 'economics'],
  ['eess.SP', 'engineering'],
  ['stat.ME', 'statistics'],
  ['cs.CL', 'ai'],
]
const PER_CATEGORY = 4

const field = (entry: string, tag: string) =>
  (entry.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? '').replace(/\s+/g, ' ').trim()

const firstSentence = (text: string) => (text.split(/(?<=\.)\s+/)[0] ?? text).slice(0, 240)

const toTask = (entry: string, domain: string): Task | undefined => {
  const id = field(entry, 'id')
    .replace(/^https?:\/\/arxiv\.org\/abs\//, '')
    .replace(/v\d+$/, '')
  const published = field(entry, 'published')
  const query = firstSentence(field(entry, 'summary'))
  if (id === '' || !inWindow(published) || query.length < 30) return undefined
  const url = `https://arxiv.org/abs/${id}`
  return {
    id: `fresh-search-arxiv-${id.replace(/[^\w]/g, '-')}`,
    family: 'search',
    input: { query, subtype: 'search.fresh' },
    gold: { url, title: field(entry, 'title'), publishedAt: published },
    aliases: [url, `https://arxiv.org/pdf/${id}`, `arXiv:${id}`],
    source: { url, asOf: published, license: 'CC0-1.0 (arXiv metadata)' },
    author: AUTHOR,
    buildDate: BUILD_DATE,
    questionType: 'navigational',
    tags: {
      domain,
      language: 'en',
      fresh: true,
      longTail: true,
      expires: EXPIRES,
      subtype: 'search.fresh',
    },
    canary: CANARY,
  }
}

const listing = ([cat, domain]: readonly [string, string]) =>
  getText(
    `https://export.arxiv.org/api/query?search_query=cat:${cat}&sortBy=submittedDate&sortOrder=descending&max_results=12`,
    'application/atom+xml',
  ).pipe(
    Effect.map((xml) =>
      xml
        .split('<entry>')
        .slice(1)
        .map((e) => toTask(e, domain))
        .filter((t): t is Task => t !== undefined)
        .slice(0, PER_CATEGORY),
    ),
    // A 503 means arXiv wants us to slow down: back off about 10 s, 20 s, 40 s, then drop the category.
    Effect.retry({
      times: 3,
      schedule: Schedule.exponential('10 seconds').pipe(Schedule.jittered),
    }),
    Effect.catch((e) =>
      Console.error(`arxiv ${cat} dropped: ${String(e).slice(0, 120)}`).pipe(
        Effect.as([] as Task[]),
      ),
    ),
    Effect.tap(() => Effect.sleep('4 seconds')),
  )

// Sequential on purpose: arXiv asks for one request every 3 seconds.
export const arxivTasks = Effect.forEach(CATEGORIES, listing, { concurrency: 1 }).pipe(
  Effect.map((x) => x.flat()),
)
