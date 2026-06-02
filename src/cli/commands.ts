// The webular command surface (one entry per capability domain) — the single
// list both the CLI router and the help text are generated from.
export const COMMANDS = {
  search: 'Search web/news/images/video and specialized sources',
  scrape: 'Fetch a single URL and return clean markdown/JSON',
  crawl: 'Recursively crawl a site and collect pages',
  map: 'Discover all URLs for a domain (sitemap + links)',
  extract: 'Extract structured data from pages via a schema',
  summarize: 'Summarize a page or text (extractive, no model)',
  answer: 'Answer a question grounded in fresh web results',
  research: 'Run a multi-step research loop and synthesize',
  parse: 'Parse local documents (PDF/DOCX/XLSX/HTML) to markdown',
  media: 'Capture screenshots/PDFs or download media',
  monitor: 'Track changes to a URL over time',
  batch: 'Run a capability over many targets concurrently',
  doctor: 'Diagnose the environment and toolchain',
  tasks: 'List the mise task graph this CLI routes through',
  mcp: 'Expose webular capabilities as an MCP server',
  diagram: 'Render the design diagrams via mmdc',
  audit: 'Run a deepsec vulnerability scan of composed tools',
  act: 'Drive a real browser — open, snapshot, screenshot, interact (agent-browser)',
} as const

export type CommandName = keyof typeof COMMANDS
export const COMMAND_NAMES = Object.keys(COMMANDS) as CommandName[]
