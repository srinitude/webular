// MCP e2e cases as data: one tool call each, against the shared fixture server
// at {origin}. error marks a call that must come back as a tool error.
export interface McpCase {
  tool: string
  args: Record<string, unknown>
  error?: boolean
}

const HTML =
  '<html><head><title>T</title></head><body><h1>T</h1><p>Body text that is long enough for readability to keep it as the article.</p><a href="/a">a</a></body></html>'

export const MCP_CASES: McpCase[] = [
  { tool: 'machine.next', args: { machine: 'cliDispatch', events: ['HELP'], select: ['done'] } },
  { tool: 'machine.next', args: { machine: 'fetch', cursor: 'not-a-cursor' }, error: true },
  { tool: 'web.fetch', args: { url: '{origin}/a', timeoutMs: 5000 } },
  { tool: 'web.fetch', args: { url: '{origin}/status?code=500' }, error: true },
  { tool: 'web.links', args: { html: HTML, base: '{origin}/', limit: 5 } },
  { tool: 'web.markdown', args: { html: HTML, select: ['markdown'] } },
  { tool: 'web.readability', args: { html: HTML, select: ['title'] } },
  // Every tool shares the paging inputs, so each one gets a select case and a
  // bad-cursor case.
  { tool: 'web.fetch', args: { url: '{origin}/a', select: ['url'] } },
  { tool: 'web.links', args: { html: HTML, base: '{origin}/', select: ['links'] } },
  ...['web.fetch', 'web.links', 'web.markdown', 'web.readability'].map((tool) => ({
    tool,
    args: { url: '{origin}/a', html: HTML, cursor: 'not-a-cursor' },
    error: true,
  })),
]
