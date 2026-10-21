# Command reference

This page describes what each `webular` command does. The README holds the
usage line, the global options, the exit codes, and examples.

## Commands

| Command | What it does |
|---|---|
| `search`    | Searches the web with no key, through DuckDuckGo's no-JS HTML page. `--source wikipedia\|hackernews\|arxiv` searches one of those keyless sources instead |
| `scrape`    | Reads one URL as clean markdown or JSON (Bun.fetch + Readability + Turndown) |
| `crawl`     | Reads a site page by page on the same host, breadth first (no rate limits, so crawl with care; an unreachable robots.txt blocks the crawl) |
| `map`       | Finds all URLs for a domain (sitemap + link BFS) |
| `extract`   | Pulls fields with CSS selectors or a schema |
| `summarize` | Picks the key sentences (no model) |
| `answer`    | Answers from sources (search → fetch → synthesize; `--urls <a,b>` reads only those pages) |
| `research`  | Runs a multi-step research loop → cited markdown report |
| `parse`     | Turns local docs into markdown (PDF/DOCX/HTML/CSV/JSON/TXT) |
| `media`     | Downloads media; takes a screenshot or PDF in a real browser (agent-browser) |
| `monitor`   | Tracks changes to a URL over time (diff + bun:sqlite) |
| `batch`     | Scrapes many URLs at once |
| `doctor`    | Checks your setup and toolchain |
| `tasks`     | Lists the mise task graph that defines the commands |
| `mcp`       | Serves webular's features as an MCP server |
| `diagram`   | Lists the XState machines that model the CLI flows (src/machines) |
| `audit`     | Reports whether `deepsec` is there, plus a scan plan (keyless; scans need LLM keys) |
| `act`       | Drives a real browser: open, snapshot, screenshot, interact (agent-browser). With `--goal`, it drives a Cua window (see [Browser mode](cua-browser-mode.md)) |
| `feed`      | Reads an RSS 2.0 or Atom 1.0 feed and lists its items (title, link, date, summary) |

### Related pages

- [Browser mode (Cua)](cua-browser-mode.md): read it before `scrape --render cua` or
  `act --goal`.
- [Reliability](reliability.md): read it for `--archive` and for what happens
  when a page is dead.
- [Agent contract](agent-contract.md): read it for the `mcp` command, the agent
  plugin, and its skills.

Return to the [README](../README.md) (navigation only).
