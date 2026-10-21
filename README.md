# webular

[![npm](https://img.shields.io/npm/v/webular.svg)](https://www.npmjs.com/package/webular)
[![CI](https://github.com/srinitude/webular/actions/workflows/ci.yml/badge.svg)](https://github.com/srinitude/webular/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![runtime: Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1.svg?logo=bun&logoColor=black)](https://bun.com)

> A web research CLI for every platform. It can scrape, crawl, map, extract, search, summarize, and gather context. It builds on **free and open-source** libraries, runs them as **Mastra** workflows and tools, defines every command in a fixed **mise** task graph, and runs on **Bun**.

`webular` brings together the web features of seven paid web-data products
(Firecrawl, Exa, Perplexity, Tavily, Parallel, Nimble, Brave) in one CLI that
needs **no paid API**. Every feature is built from open-source parts.

## Install

```bash
bun add -g webular      # or: npm i -g webular  (requires bun on PATH)
```

`webular` needs [Bun](https://bun.com) to run. The `run:<command>` tasks in
`mise.toml` define every subcommand. `mise run build` turns them into a
committed table, `src/cli/dispatch-table.ts`. The CLI reads that table and
starts the command itself, so no mise process runs per command. A test fails
when the table and `mise.toml` disagree. [mise](https://mise.jdx.dev) ships as
a pinned npm dependency for the build, `doctor`, and `tasks`. A mise install
on your PATH is used when present.

Commands run from minified bundles in `dist/commands`. A bundle starts with
about half the CPU that the TypeScript source needs. `mise run build` makes the
bundles. Set `WEBULAR_DEV=1` to run straight from `src/` while you edit, with no
build step. When a bundle is missing, the CLI runs that command from `src/`.

### Standalone executable

`mise run build` also compiles a native `dist/bin/webular` (`webular.exe` on
Windows). `mise run compile:all` builds one for every Bun target: macOS arm64
and x64, Linux x64 and arm64 with glibc or musl, and Windows x64 and arm64.

The executable starts faster and uses less CPU than `bun bin/webular.ts`. It
runs each command with itself as the Bun runtime, so you need no separate Bun.
It finds its commands by walking up from its own folder to `mise.toml`. Keep
it inside the package folder, below `mise.toml` and `dist/commands`. The
default spot is `dist/bin/webular`.

## Usage

```bash
webular <command> [options]
webular --help
```

| Command | What it does |
|---|---|
| `search`    | Keyless web search via DuckDuckGo's no-JS HTML endpoint; `--source wikipedia\|hackernews\|arxiv` searches one of those keyless sources instead |
| `scrape`    | Fetch one URL → clean markdown/JSON (Bun.fetch + Readability + Turndown) |
| `crawl`     | Recursive same-host BFS crawl (no robots.txt/rate-limiting — crawl responsibly) |
| `map`       | Discover all URLs for a domain (sitemap + link BFS) |
| `extract`   | Structured extraction via CSS selectors / schema |
| `summarize` | Extractive summary (no model) |
| `answer`    | Grounded answer (search → fetch → synthesize; `--urls <a,b>` reads only those pages) |
| `research`  | Multi-step research loop → cited markdown report |
| `parse`     | Local docs → markdown (PDF/DOCX/HTML/CSV/JSON/TXT) |
| `media`     | Download media; screenshot/PDF via a real browser (agent-browser) |
| `monitor`   | Track changes to a URL over time (diff + bun:sqlite) |
| `batch`     | Scrape many URLs concurrently |
| `doctor`    | Diagnose environment & toolchain |
| `tasks`     | List the mise task graph that defines the commands |
| `mcp`       | Expose webular capabilities as an MCP server |
| `diagram`   | List the XState machines that model the CLI flows (src/machines) |
| `audit`     | Report `deepsec` availability + scan plan (keyless; scans need LLM keys) |
| `act`       | Drive a real browser — open, snapshot, screenshot, interact (agent-browser) |
| `feed`      | Read an RSS 2.0 or Atom 1.0 feed and list its items (title, link, date, summary) |

**Global options:** `--json`, `-o/--output <file>`, `--timeout <ms>` (per request attempt), `-h/--help`, `-V/--version`.

**Exit codes:** `0` success · `1` failure · `2` usage error · `3` partial failure (`batch`) · `127` a command could not start · `128 + n` stopped by signal `n` (`130` for SIGINT, `143` for SIGTERM).

**Reliability:** every fetch retries 408, 429, 502, 503, and 504 on a fixed backoff, or waits the server's `Retry-After` (capped at 10 s). `scrape --archive` falls back to the Wayback Machine's raw capture when the page is dead (404, 410, 5xx, network error, or timeout), and reports the capture as `archivedFrom`.

```bash
webular scrape https://example.com --json
webular search "bun javascript runtime" --json
webular search "bun runtime" --source wikipedia --json   # also: hackernews, arxiv
webular feed https://hnrss.org/frontpage --limit 5
webular map https://example.com
webular research "web scraping in 2026" --depth 3 -o report.md
```

## Architecture

```text
you ▸ webular CLI ▸ command process (table from mise.toml) ▸ Mastra workflow ▸ Mastra tools ▸ FOSS libs ▸ web
```

The CLI never imports feature code. It parses argv and looks the command up in
the table generated from the `run:<command>` tasks in `mise.toml`. Then it
starts that command in its own process at the package root, with the same Bun
that runs the CLI. The command's exit code becomes the CLI's exit code. A
SIGINT or SIGTERM sent to the CLI goes on to the command.

mise owns **one task graph with no cycles**
(`setup → format → lint → typecheck → build → test → validate → ci`, and each
command branches off `setup`). Each command is a **Mastra workflow** built from
**Mastra tools that use no model** and wrap open-source libraries.

Tested [XState](https://stately.ai/docs) machines in
[`src/machines/`](src/machines/) model the CLI flows. Model-based tests in
[`tests/machines/`](tests/machines/) walk the paths of each machine against the
real code:

- [`cli-dispatch.ts`](src/machines/cli-dispatch.ts): argv to help, version, an
  unknown-command error, or the command process from the dispatch table and
  its exit code.
- [`command-lifecycle.ts`](src/machines/command-lifecycle.ts): input
  validation, the workflow run, rendering, and the exit-code rule for
  partial failures.
- [`fetch.ts`](src/machines/fetch.ts): the timeout for each attempt, bounded
  retry, same-host redirects, and each failure the fetch layer reports.

The CLI follows the [Command Line Interface Guidelines](https://clig.dev): data
goes to stdout, logs go to stderr, `--json` works everywhere, `-o` writes to a
file, parsing is forgiving, `--help` is helpful, and `doctor` checks your setup.

## Development

This project is built test-first. The toolchain is pinned in `mise.toml`.
In a fresh clone, run `mise trust ./mise.toml` once before anything else.

```bash
mise run ci         # the single CI path: setup→lint→typecheck→build→test→validate
mise run format     # apply formatting (mutating; deliberately OFF the check-only ci spine)
mise run test       # run the bun test suite (real services, no mocks)
bun bin/webular.ts scrape https://example.com --json
```

The suite enforces these rules: at most 200 lines per file, at most 30 lines per
construct, nesting depth of 3 or less, no orphaned exports, and no mocks or
stubs. Tests check real behavior against a local `Bun.serve` fixture, so they
give the same result every run and work offline.

Cases that need the live internet (DuckDuckGo search, a real browser) are opt-in:
`WEBULAR_TEST_LIVE=1 mise run test`. DuckDuckGo blocks many datacenter IPs.
The `search --source` and `feed` suites run offline: `WEBULAR_SOURCE_ORIGIN`
points the Wikipedia, Hacker News, and arXiv endpoints at the local fixture.

## License

Apache-2.0 © Kiren Srinivasan. Built on Bun, Mastra, mise, XState,
deepsec, and agent-browser, plus a set of open-source libraries.
