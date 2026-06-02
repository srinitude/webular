# webular

> Universal web research CLI — scrape, crawl, map, extract, search, summarize, and gather context, by composing **free & open-source** libraries into **Mastra** workflows/tools, orchestrated through a deterministic **mise** task graph, on the **Bun** runtime.

`webular` distills the unique web capabilities of seven commercial web-data
products (Firecrawl, Exa, Perplexity, Tavily, Parallel, Nimble, Brave) into a
single CLI that needs **no paid API** — every capability is implemented from
open-source building blocks. See [`research/INVENTORY.md`](research/INVENTORY.md)
for the full capability catalog and [`research/FOSS.md`](research/FOSS.md) for
the library mapping.

## Install

```bash
bun add -g webular      # or: npm i -g webular  (requires bun + mise on PATH)
```

`webular` requires [Bun](https://bun.com) (runtime) and [mise](https://mise.jdx.dev)
(every subcommand is routed through `mise run run:<command>`).

## Usage

```bash
webular <command> [options]
webular --help
```

| Command | Capability |
|---|---|
| `search`    | Search web/news/images/video & specialized sources (SearXNG/DDG-class) |
| `scrape`    | Fetch one URL → clean markdown/JSON (Bun.fetch + Readability + Turndown) |
| `crawl`     | Recursive same-host BFS crawl |
| `map`       | Discover all URLs for a domain (sitemap + link BFS) |
| `extract`   | Structured extraction via CSS selectors / schema |
| `summarize` | Extractive summary (no model) |
| `answer`    | Grounded answer (search → fetch → synthesize) |
| `research`  | Multi-step research loop → cited markdown report |
| `parse`     | Local docs → markdown (PDF/DOCX/HTML/CSV/JSON/TXT) |
| `media`     | Download media; screenshot/PDF via Playwright |
| `monitor`   | Track changes to a URL over time (diff + bun:sqlite) |
| `batch`     | Run a capability over many targets concurrently |
| `doctor`    | Diagnose environment & toolchain |
| `tasks`     | List the mise task graph this CLI routes through |
| `mcp`       | Expose webular capabilities as an MCP server |
| `diagram`   | Render the design diagrams via `mmdc` |
| `audit`     | Plan/run a `deepsec` vulnerability scan |
| `act`       | Drive a real browser — open, snapshot, screenshot, interact (agent-browser) |

**Global options:** `--json`, `-o/--output <file>`, `-q/--quiet`, `--timeout <ms>`, `-h/--help`, `-V/--version`.

```bash
webular scrape https://example.com --json
webular search "bun javascript runtime" --json
webular map https://example.com
webular research "web scraping in 2026" --depth 3 -o report.md
```

## Architecture

```
you ▸ webular CLI ▸ mise (universal task graph) ▸ Mastra workflow ▸ Mastra tools ▸ FOSS libs ▸ web
```

The CLI never calls capability code directly: it parses argv and routes to
`mise run run:<command> -- <args>`. mise owns a **single, acyclic task graph**
(`setup → format → lint → typecheck → build → test → validate → ci`, with each
command branching off `setup`). Each command is a **Mastra workflow** built from
**non-model Mastra tools** that wrap open-source libraries.

The design is captured in seven diagrams under [`docs/diagrams/`](docs/diagrams/)
(sequence, class, state, ER, user-journey, requirement, mindmap), generated with
`mmdc` and treated as the source of truth for the implementation.

Designed per the [Command Line Interface Guidelines](https://clig.dev): machine
data to stdout, logs to stderr, `--json` everywhere, `-o` file sinks, forgiving
parsing, helpful `--help`, and a `doctor` for diagnostics.

## Development

This project is built test-first. The toolchain is pinned in `mise.toml`.

```bash
mise run ci         # the single CI path: setup→format→lint→typecheck→build→test→validate
mise run test       # run the bun test suite (real services, no mocks)
mise run run:scrape -- --url https://example.com --json
```

Conventions enforced by the suite: ≤200 lines/file, ≤30 lines/construct,
nesting depth ≤3, and no mocks/stubs — tests exercise real behavior and real
services.

## License

Apache-2.0 © Kiren Srinivasan. Built on Bun, Mastra, mermaid-cli, opensrc,
deepsec, and agent-browser, plus the open-source libraries cataloged in
`research/FOSS.md`.
