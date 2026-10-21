// The webular command surface (one entry per capability domain) — the single
// list both the CLI router and the help text are generated from.
export const COMMANDS = {
  search: 'Search the web, news, images, video, and other sources',
  scrape: 'Fetch one URL and return clean markdown or JSON',
  crawl: 'Follow links on a site and collect its pages',
  map: 'Find all the URLs on a domain (sitemap and links)',
  extract: 'Pull named fields out of pages using a schema',
  summarize: 'Summarize a page or text (picks key sentences, no model)',
  answer: 'Answer a question using fresh web results (--urls <a,b> reads only those pages)',
  research: 'Research a topic in several steps and write a report',
  parse: 'Turn local files (PDF/DOCX/HTML/MD/CSV/JSON/TXT) into markdown',
  media: 'Save screenshots and PDFs, or download media',
  monitor: 'Watch a URL and show what changed',
  batch: 'Scrape many URLs at the same time',
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
export const COMMAND_NAMES = Object.keys(COMMANDS) as CommandName[]
