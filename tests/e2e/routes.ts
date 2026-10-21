// Fixture routes the e2e cases add on top of the shared table: recorded-shape
// search source answers whose hits point back at the fixture, and one feed.
import type { Routes } from '../_support/fixture.ts'

const json = (body: unknown) => Response.json(body)

const rss = (origin: string) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture feed</title><link>${origin}/</link>` +
  `<item><title>Alpha</title><link>${origin}/a</link><description>First</description></item>` +
  `<item><title>Beta</title><link>${origin}/b</link><description>Second</description></item>` +
  `<item><title>Gamma</title><link>${origin}/c</link><description>Third</description></item>` +
  '</channel></rss>'

// DuckDuckGo ('/html/') has no route, so the web source falls back: Wikipedia
// answers empty, then Hacker News answers with fixture pages.
export const e2eRoutes = (origin: string): Routes => ({
  '/w/api.php': () => json({ query: { search: [] } }),
  '/api/v1/search': () =>
    json({
      hits: [
        { title: 'Alpha', url: `${origin}/a`, objectID: '1', story_text: 'Alpha story' },
        { title: 'Beta', url: `${origin}/b`, objectID: '2', story_text: 'Beta story' },
      ],
    }),
  '/feed.xml': () =>
    new Response(rss(origin), { headers: { 'content-type': 'application/rss+xml' } }),
})
