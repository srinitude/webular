// FEED workflow: fetch an RSS 2.0 or Atom 1.0 feed and return its items
// (title, link, date, summary), parsed as XML with linkedom. No model, no key.
// A url that is not a feed falls back through core/feed-source.ts.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { DOMParser } from 'linkedom'
import { z } from 'zod'
import { resolveFeed } from '../core/feed-source.ts'
import { stepRuntime } from './runtime.ts'

const feedInput = z.object({
  url: z.url(),
  limit: z.number().int().positive().default(20),
  timeoutMs: z.number().int().positive().optional(),
  archive: z.boolean().optional(),
})

const feedItem = z.object({
  title: z.string(),
  url: z.string(),
  published: z.string(),
  summary: z.string(),
})

const feedOutput = z.object({
  url: z.string(),
  feedUrl: z.string().optional(),
  archivedFrom: z.string().optional(),
  title: z.string(),
  count: z.number(),
  items: z.array(feedItem),
})

const child = (el: Element, tag: string): Element | undefined =>
  el.getElementsByTagName(tag)[0] as Element | undefined
const text = (el: Element, ...tags: string[]): string => {
  for (const tag of tags) {
    const value = child(el, tag)?.textContent?.replace(/\s+/g, ' ').trim()
    if (value) return value
  }
  return ''
}

// Atom puts the link in <link href>; prefer rel="alternate" (or no rel).
function atomLink(el: Element): string {
  const links = [...el.getElementsByTagName('link')] as Element[]
  const alt = links.find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate')
  return (alt ?? links[0])?.getAttribute('href') ?? ''
}

function parseFeed(xml: string, limit: number) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const root = doc.documentElement as unknown as Element
  const atom = root.tagName.toLowerCase() === 'feed'
  const nodes = [...doc.getElementsByTagName(atom ? 'entry' : 'item')] as unknown as Element[]
  const items = nodes.slice(0, limit).map((el) => ({
    title: text(el, 'title'),
    url: atom ? atomLink(el) : text(el, 'link', 'guid'),
    published: text(el, 'pubDate', 'published', 'updated', 'dc:date'),
    summary: text(el, 'description', 'summary', 'content'),
  }))
  const head = atom ? root : (child(root, 'channel') ?? root)
  return { title: text(head, 'title'), items }
}

const feedStep = createStep({
  id: 'feed',
  inputSchema: feedInput,
  outputSchema: feedOutput,
  execute: ({ inputData }) => {
    const { url, timeoutMs, limit, archive } = inputData
    return stepRuntime.runPromise(
      Effect.map(resolveFeed(url, { timeoutMs, archive }), ({ xml, feedUrl, archivedFrom }) => {
        const { title, items } = parseFeed(xml, limit)
        return { url, feedUrl, archivedFrom, title, count: items.length, items }
      }),
    )
  },
})

export const feedWorkflow = createWorkflow({
  id: 'feed',
  inputSchema: feedInput,
  outputSchema: feedOutput,
})
  .then(feedStep)
  .commit()
