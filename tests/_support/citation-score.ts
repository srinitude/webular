// Scores answer and research output on the citation dev set, with no model:
// faithfulness (each answer sentence appears word for word in a page it cites),
// the sure-but-wrong rate (an answer given that misses the gold fact, or any
// answer to a question no page answers), and the no-answer rate on those questions.
import { type DevCase, type Page, pageHtml, pagePath } from './citation-dev-set.ts'
import type { Routes } from './fixture.ts'

interface Scored {
  readonly name: string
  readonly claims: number
  readonly backed: number
  readonly abstained: boolean
  readonly sureWrong: boolean
}

const squash = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '')
    .toLowerCase()
const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
const backedBy = (claim: string, pages: ReadonlyArray<Page>) =>
  pages.some((p) => squash(p.paras.join(' ')).includes(squash(claim)))

// One case: `cited` are the pages the output cites for `text`; no text or no
// cited page counts as declining to answer.
export const scoreCase = (c: DevCase, text: string, cited: ReadonlyArray<Page>): Scored => {
  const claims = sentencesOf(text)
  const abstained = claims.length === 0 || cited.length === 0
  const right = c.gold !== null && text.includes(c.gold)
  return {
    name: c.name,
    claims: claims.length,
    backed: claims.filter((s) => backedBy(s, cited)).length,
    abstained,
    sureWrong: !abstained && !right,
  }
}

interface Metrics {
  readonly faithfulness: number
  readonly sureButWrong: number
  readonly noAnswer: number
}
const ratio = (n: number, d: number) => (d === 0 ? 1 : Math.round((n / d) * 1000) / 1000)
export const metricsOf = (
  cases: ReadonlyArray<DevCase>,
  scored: ReadonlyArray<Scored>,
): Metrics => {
  const unanswerable = scored.filter((_, i) => cases[i]?.gold === null)
  const sum = (f: (s: Scored) => number) => scored.reduce((n, s) => n + f(s), 0)
  return {
    faithfulness: ratio(
      sum((s) => s.backed),
      sum((s) => s.claims),
    ),
    sureButWrong: ratio(scored.filter((s) => s.sureWrong).length, scored.length),
    noAnswer: ratio(unanswerable.filter((s) => s.abstained).length, unanswerable.length),
  }
}

// Every dev page at its own path, plus the recorded-shape Hacker News search
// source the web chain falls back to: it answers a query with the pages of the
// case whose topic the query names (Wikipedia answers empty).
export const devRoutes =
  (cases: ReadonlyArray<DevCase>) =>
  (origin: string): Routes => {
    const pages = cases.flatMap((c) => c.pages)
    const routes: Routes = Object.fromEntries(
      pages.map((p) => [
        pagePath(p),
        () => new Response(pageHtml(p), { headers: { 'content-type': 'text/html' } }),
      ]),
    )
    const hitsFor = (q: string) =>
      (cases.find((c) => q.toLowerCase().includes(c.ask.toLowerCase()))?.pages ?? []).map(
        (p, i) => ({
          title: p.title,
          url: `${origin}${pagePath(p)}`,
          objectID: String(i + 1),
        }),
      )
    return {
      ...routes,
      '/w/api.php': () => Response.json({ query: { search: [] } }),
      '/api/v1/search': (_req, url) =>
        Response.json({ hits: hitsFor(url.searchParams.get('query') ?? '') }),
    }
  }

export const pageAt = (cases: ReadonlyArray<DevCase>, url: string) =>
  cases.flatMap((c) => c.pages).find((p) => url.endsWith(pagePath(p)))
