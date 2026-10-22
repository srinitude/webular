// The webular command surface (one entry per capability domain) — the single
// list both the CLI router and the help text are generated from.
export const COMMANDS = {
  search: 'Search the web, news, images, video, and other sources',
  scrape: 'Fetch one URL and return clean markdown or JSON. For two or more URLs, use batch.',
  crawl: 'Follow links on a site and collect its pages',
  map: 'Find all the URLs on a domain (sitemap and links)',
  extract: 'Pull named fields out of pages using a schema',
  summarize: 'Summarize a page or text (key sentences with offsets, no model)',
  answer:
    'Answer a question using fresh web results (--urls <url>, repeatable, reads only those pages)',
  research: 'Research a topic in several steps and write a report',
  parse: 'Turn local files (PDF/DOCX/HTML/MD/CSV/JSON/TXT) into markdown',
  media: 'Save screenshots and PDFs, or download media',
  monitor: 'Watch a URL and show what changed',
  batch: 'Read two or more URLs in one call, not one scrape per URL',
  doctor: 'Check your setup and tools',
  tasks: 'List the mise tasks this CLI runs',
  mcp: 'Run webular as an MCP server',
  diagram: 'List the XState machines that model the CLI flows (src/machines)',
  audit: 'Show whether deepsec is installed and the scan plan (no key needed)',
  act: 'Control a real browser: open, snapshot, screenshot, interact (agent-browser)',
  feed: 'Read an RSS or Atom feed and list its items',
  jev: 'Learn from recorded Jev calls (learn) or label one as an eval case (correct)',
} as const

export type CommandName = keyof typeof COMMANDS

// The main argument each command takes, shown on its usage line.
export const ARGUMENTS: Partial<Record<CommandName, string>> = {
  search: '<query>',
  scrape: '<url>',
  crawl: '<url>',
  map: '<url>',
  extract: '<url>',
  summarize: '<url>',
  answer: '<question>',
  research: '<topic>',
  parse: '<file>',
  media: '--url <url>',
  monitor: '<url>',
  batch: '<url>...',
  act: '<url>',
  feed: '<url>',
}

// One real call per command, shown under EXAMPLE in its --help.
export const EXAMPLES: Record<CommandName, string> = {
  search: 'webular search "bun vs node"',
  scrape: 'webular scrape https://example.com',
  crawl: 'webular crawl https://example.com --limit 10',
  map: 'webular map https://example.com',
  extract: 'webular extract https://example.com --fields title,price',
  summarize: 'webular summarize https://example.com',
  answer: 'webular answer "what is bun?"',
  research: 'webular research "home solar panels"',
  parse: 'webular parse report.pdf',
  media: 'webular media --url https://example.com --screenshot',
  monitor: 'webular monitor https://example.com',
  batch: 'webular batch --urls https://example.com --urls https://example.org',
  doctor: 'webular doctor',
  tasks: 'webular tasks',
  mcp: 'webular mcp',
  diagram: 'webular diagram',
  audit: 'webular audit',
  act: 'webular act https://example.com',
  feed: 'webular feed https://example.com/feed.xml',
  jev: 'webular jev learn',
}
export const COMMAND_NAMES = Object.keys(COMMANDS) as CommandName[]
