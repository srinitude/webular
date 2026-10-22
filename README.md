# webular

[![npm](https://img.shields.io/npm/v/webular.svg)](https://www.npmjs.com/package/webular)
[![CI](https://github.com/srinitude/webular/actions/workflows/ci.yml/badge.svg)](https://github.com/srinitude/webular/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/srinitude/webular/badge)](https://scorecard.dev/viewer/?uri=github.com/srinitude/webular)
[![runtime: Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1.svg?logo=bun&logoColor=black)](https://bun.com)

> A web research CLI for every platform. It can scrape, crawl, map, extract, search, summarize, and gather context. It uses **free and open-source** libraries. It runs them as **Mastra** workflows and tools, defines every command in a fixed **mise** task graph, and runs on **Bun**.

`webular` puts the web features of six paid web-data products in one CLI:
Firecrawl, Exa, Perplexity, Tavily, Parallel, and Nimble.
It needs **no paid API**. Every feature uses open-source parts.

## Why webular

- **No paid API.** Every feature runs on open-source parts.
- **One CLI.** Search, scrape, crawl, map, extract, answer, research, and feed share one command set and one JSON contract.
<!-- bench:start readme -->
- **Measured, not claimed.** On the committed peer run ([peers-2026-10-22T00-58-50-543Z.json](bench/results/peers-2026-10-22T00-58-50-543Z.json)), webular search scored 1.000 on 4 search tasks, while exa scored 1.000 on 4 and firecrawl scored 1.000 on 4. Read [the benchmark results](docs/benchmarks.md) for every score and the method behind it.
<!-- bench:end -->

## Install

Pick one channel. This page shows npm. The other channels are in
[Install channels](docs/install.md): Bun, Homebrew, Scoop, winget, and GitHub
release binaries with their install scripts.

- **npm** (any OS; needs only Node). The root package is a Node launcher. It
  installs the matching `webular-<platform>` native package through
  `optionalDependencies`.

  ```bash
  npm i -g webular
  ```

To run from source, use the bundles, or build the standalone executable, read
[Build and run](docs/build-and-run.md).

## Usage

```bash
webular <command> [options]
webular --help
```

| Command | What it does |
|---|---|
| `search`    | Searches the web with no key, or one keyless source |
| `scrape`    | Reads one URL as clean markdown or JSON |
| `crawl`     | Reads a site page by page on the same host |
| `map`       | Finds all URLs for a domain |
| `extract`   | Pulls fields with CSS selectors or a schema |
| `summarize` | Picks the key sentences (no model) |
| `answer`    | Answers from sources |
| `research`  | Runs a multi-step research loop → cited markdown report |
| `parse`     | Turns local docs into markdown |
| `media`     | Downloads media; takes a screenshot or PDF in a real browser |
| `monitor`   | Tracks changes to a URL over time |
| `batch`     | Scrapes many URLs at once |
| `doctor`    | Checks your setup and toolchain |
| `tasks`     | Lists the mise task graph that defines the commands |
| `mcp`       | Serves webular's features as an MCP server |
| `diagram`   | Lists the XState machines that model the CLI flows |
| `audit`     | Reports whether `deepsec` is there, plus a scan plan |
| `act`       | Drives a real browser |
| `feed`      | Reads an RSS 2.0 or Atom 1.0 feed and lists its items |

Read [Command reference](docs/commands.md) for the full description of each
command.

**Global options:** `--json`, `-o/--output <file>`, `--timeout <ms>` (per request attempt), `-h/--help`, `-V/--version`.

### Exit codes

- `0`: success
- `1`: failure
- `2`: usage error
- `3`: partial failure (`batch`)
- `127`: a command could not start
- `128 + n`: stopped by signal `n` (`130` for SIGINT, `143` for SIGTERM)

### Examples

```bash
webular scrape https://example.com --json
webular search "bun javascript runtime" --json
webular search "bun runtime" --source wikipedia --json   # also: hackernews, arxiv
webular feed https://hnrss.org/frontpage --limit 5
webular map https://example.com
webular research "web scraping in 2026" --depth 3 -o report.md
```

## More documentation

- [Command reference](docs/commands.md): what each command does.
- [Reliability](docs/reliability.md): retries, archive copies, and index
  fallbacks. Read it when a page is dead or a site will not answer.
- [Browser mode (Cua)](docs/cua-browser-mode.md): how to drive a throwaway
  browser window. Read it before `scrape --render cua` or `act --goal`.
- [Agent contract](docs/agent-contract.md): the CLI, the MCP server, the agent
  plugin, and its skills, as an AI agent uses them.
- [Architecture](docs/architecture.md): how a command runs, and the XState
  machines.
- [Development](docs/development.md): build rules, tests, and live-internet
  tests.
- [Best practices](docs/best-practices.md): the practices the suite checks.

## License

Apache-2.0 © Kiren Srinivasan. Built on Bun, Mastra, mise, XState,
deepsec, and agent-browser, plus a set of open-source libraries.
