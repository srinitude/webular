// One zod input schema per webular command. Each key is a real flag of
// src/commands/<command>.ts; runCommand passes it as --key value.
import { z } from 'zod'

const url = z
  .url({ protocol: /^https?$/ })
  .describe('Full http or https URL, such as https://example.com')
const count = (max: number, what: string) =>
  z.number().int().min(1).max(max).optional().describe(what)
const words = (what: string) => z.string().min(1).describe(what)
const flag = (what: string) => z.boolean().optional().describe(what)
const archive = flag('When the live page fails, read its closest Wayback Machine copy instead')
const searchSources = ['web', 'wikipedia', 'hackernews', 'arxiv', 'crossref', 'openalex'] as const

export const schemas = {
  search: z.strictObject({
    query: words('What to search for, in plain words'),
    limit: count(50, 'Most results to return (default 10)'),
    source: z
      .enum(searchSources)
      .optional()
      .describe('Where to search (default web; if web fails, it tries the others in order)'),
  }),
  scrape: z.strictObject({
    url,
    archive,
    render: z
      .enum(['agent-browser', 'cua', 'off'])
      .optional()
      .describe('Render the page in a browser first: agent-browser, cua, or off'),
  }),
  map: z.strictObject({ url, limit: count(10_000, 'Most URLs to return') }),
  summarize: z.strictObject({
    text: words('Text to summarize').optional(),
    url: url.optional(),
    sentences: count(25, 'Sentences to keep (default 3)'),
  }),
  crawl: z.strictObject({
    url,
    limit: count(1000, 'Most pages to visit (default 5)'),
    depth: z
      .number()
      .int()
      .min(0)
      .max(10)
      .optional()
      .describe('Link hops from the start page (default 2)'),
    concurrency: count(32, 'Pages to fetch at once (default 4)'),
  }),
  extract: z.strictObject({
    url,
    fields: words('Name:selector pairs split by commas, such as title:h1,price:.price').optional(),
    selector: words('One CSS selector, such as h1').optional(),
  }),
  answer: z.strictObject({
    query: words('The question to answer'),
    sources: count(10, 'Web sources to read (default 3)'),
    sentences: count(25, 'Sentences in the answer (default 3)'),
    urls: z
      .array(url)
      .min(1)
      .max(10)
      .optional()
      .describe('Read only these pages, with no web search, and cite them'),
  }),
  research: z.strictObject({
    topic: words('The topic to research'),
    depth: count(10, 'How many sources to dig into (default 3)'),
    sentences: count(25, 'Sentences per source (default 2)'),
  }),
  parse: z.strictObject({ file: words('Path to a local file, such as report.pdf') }),
  media: z.strictObject({
    url,
    output: words('File path to save to'),
    download: flag('Download the file at the URL (the default)'),
    screenshot: flag('Take a screenshot of the page'),
    pdf: flag('Print the page as a PDF'),
    'max-bytes': count(1_000_000_000, 'Largest file to save, in bytes'),
  }),
  monitor: z.strictObject({ url }),
  batch: z.strictObject({
    urls: z.array(url).min(1).max(1000).optional().describe('The URLs to scrape'),
    input: words('Path to a file with one URL per line').optional(),
    concurrency: count(32, 'Pages to fetch at once (default 4)'),
  }),
  act: z.strictObject({
    url: url.optional(),
    screenshot: words('File path for a screenshot').optional(),
    goal: words(
      'A plain goal for the Cua window, such as: click "Press me" until it says "Done". Needs WEBULAR_CUA_WINDOW. No url needed with goal.',
    ).optional(),
  }),
  feed: z.strictObject({
    url: url.describe('A feed URL, or a page URL. webular finds its feed.'),
    limit: count(500, 'Most items to return (default 20)'),
    archive,
  }),
  jev: z.strictObject({
    action: z.enum(['learn', 'correct']).describe('learn tests lessons; correct labels one call'),
    id: words('The recorded call id, for correct').optional(),
    label: words('The right answer, for correct').optional(),
    input: words('Path to a JSON file with the call input, for correct').optional(),
  }),
  // These four take no input: each reports on webular itself.
  doctor: z.strictObject({}),
  tasks: z.strictObject({}),
  diagram: z.strictObject({}),
  audit: z.strictObject({}),
}

// Output fields a tool adds only sometimes, named so an agent knows to look
// for them. Every other field passes through: each output is a loose object.
const archivedFrom = z.string().optional().describe('The Wayback Machine copy that was read')
export const outputs: Partial<Record<keyof typeof schemas, z.ZodObject>> = {
  scrape: z.looseObject({ archivedFrom }),
  feed: z.looseObject({
    feedUrl: z.string().optional().describe('The feed that was read'),
    archivedFrom,
  }),
  search: z.looseObject({
    source: z.enum(searchSources).optional().describe('The source that answered'),
  }),
}
