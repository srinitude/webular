# webular

[![npm](https://img.shields.io/npm/v/webular.svg)](https://www.npmjs.com/package/webular)
[![CI](https://github.com/srinitude/webular/actions/workflows/ci.yml/badge.svg)](https://github.com/srinitude/webular/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![runtime: Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1.svg?logo=bun&logoColor=black)](https://bun.com)

> A web research CLI for every platform. It can scrape, crawl, map, extract, search, summarize, and gather context. It uses **free and open-source** libraries. It runs them as **Mastra** workflows and tools, defines every command in a fixed **mise** task graph, and runs on **Bun**.

`webular` puts the web features of seven paid web-data products in one CLI:
Firecrawl, Exa, Perplexity, Tavily, Parallel, Nimble, and Brave.
It needs **no paid API**. Every feature uses open-source parts.

## Install

Pick one channel.

- **npm** (any OS; needs only Node). The root package is a Node launcher. It
  installs the matching `webular-<platform>` native package through
  `optionalDependencies`.

  ```bash
  npm i -g webular
  ```

- **Bun** (needs Node on your PATH, because the launcher starts with a Node
  shebang).

  ```bash
  bun add -g webular
  ```

- **Homebrew** (macOS and glibc Linux).

  ```bash
  brew install srinitude/webular/webular
  ```

- **Scoop** (Windows).

  ```powershell
  scoop bucket add webular https://github.com/srinitude/scoop-webular
  scoop install webular
  ```

- **winget** (Windows). It works once the manifest pull request to
  `microsoft/winget-pkgs` has merged.

  ```powershell
  winget install Srinitude.Webular
  ```

- **GitHub release binaries** (any platform). Download
  `webular-<platform>` (`webular-<platform>.exe` on Windows) from the
  [releases page](https://github.com/srinitude/webular/releases). Then verify
  it:

  ```bash
  sha256sum --check --ignore-missing SHA256SUMS
  gh attestation verify webular-<platform> --repo srinitude/webular
  ```

  The platforms are `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`,
  `linux-x64-musl`, `linux-arm64-musl`, `windows-x64`, and `windows-arm64`.
  On macOS and Linux, including musl, `scripts/install.sh` picks the right
  asset, checks it against `SHA256SUMS`, and installs it to
  `~/.webular/bin/webular`:

  ```bash
  curl -fsSL https://github.com/srinitude/webular/releases/latest/download/install.sh | sh
  ```

  On Windows, `scripts/install.ps1` does the same in PowerShell and installs
  to `~\.webular\bin\webular.exe`:

  ```powershell
  irm https://github.com/srinitude/webular/releases/latest/download/install.ps1 | iex
  ```

To run from source, you need [Bun](https://bun.com). The `run:<command>`
tasks in `mise.toml` define every subcommand. `mise run build` turns them into
a committed table, `src/cli/dispatch-table.ts`. The CLI reads that table and
starts the command itself, so no mise process runs per command. A test fails
when the table and `mise.toml` disagree. [mise](https://mise.jdx.dev) comes as
a pinned npm dependency for the build, `doctor`, and `tasks`. If mise is on
your PATH, webular uses that copy.

Commands run from minified bundles in `dist/commands`. A bundle starts with
about half the CPU that the TypeScript source needs. `mise run build` makes the
bundles. To run straight from `src/` while you edit, set `WEBULAR_DEV=1`.
Then you need no build step. When a bundle is missing, the CLI runs that
command from `src/`.

### Standalone executable

`mise run build` also compiles a native `dist/bin/webular` (`webular.exe` on
Windows). `mise run compile:all` builds one for every Bun target: macOS arm64
and x64, Linux x64 and arm64 with glibc or musl, and Windows x64 and arm64.

The executable starts faster and uses less CPU than `bun bin/webular.ts`. It
runs each command with itself as the Bun runtime, so you need no separate Bun.
It finds its commands by walking up from its own folder to `mise.toml`. Keep
it in the package folder, below `mise.toml` and `dist/commands`. The default
path is `dist/bin/webular`.

## Usage

```bash
webular <command> [options]
webular --help
```

| Command | What it does |
|---|---|
| `search`    | Searches the web with no key, through DuckDuckGo's no-JS HTML page. `--source wikipedia\|hackernews\|arxiv` searches one of those keyless sources instead |
| `scrape`    | Reads one URL as clean markdown or JSON (Bun.fetch + Readability + Turndown) |
| `crawl`     | Reads a site page by page on the same host, breadth first (no robots.txt or rate limits, so crawl with care) |
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
| `act`       | Drives a real browser: open, snapshot, screenshot, interact (agent-browser) |
| `feed`      | Reads an RSS 2.0 or Atom 1.0 feed and lists its items (title, link, date, summary) |

**Global options:** `--json`, `-o/--output <file>`, `--timeout <ms>` (per request attempt), `-h/--help`, `-V/--version`.

### Exit codes

- `0`: success
- `1`: failure
- `2`: usage error
- `3`: partial failure (`batch`)
- `127`: a command could not start
- `128 + n`: stopped by signal `n` (`130` for SIGINT, `143` for SIGTERM)

### Reliability

- Every fetch retries 408, 429, 502, 503, and 504 on a fixed backoff. Or it waits for the server's `Retry-After` (capped at 10 s).
- `scrape --archive` uses the Wayback Machine's raw capture when the page is dead (404, 410, 5xx, network error, or timeout). It reports the capture as `archivedFrom`.

### Examples

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
the table built from the `run:<command>` tasks in `mise.toml`. Then it starts
that command in its own process at the package root, with the same Bun that
runs the CLI. The command's exit code becomes the CLI's exit code. A SIGINT or
SIGTERM sent to the CLI goes on to the command.

mise owns **one task graph with no cycles**
(`setup → format → lint → typecheck → build → test → validate → ci`). Each
command branches off `setup`. Each command is a **Mastra workflow**. It is built
from **Mastra tools that use no model** and wrap open-source libraries.

Tested [XState](https://stately.ai/docs) machines in
[`src/machines/`](src/machines/) model the CLI flows. Model-based tests in
[`tests/machines/`](tests/machines/) walk each machine's paths against the
real code:

- [`cli-dispatch.ts`](src/machines/cli-dispatch.ts): argv to help, version, an
  unknown-command error, or the command process from the dispatch table and
  its exit code.
- [`command-lifecycle.ts`](src/machines/command-lifecycle.ts): input
  validation, the workflow run, rendering, and the exit-code rule for
  partial failures.
- [`fetch.ts`](src/machines/fetch.ts): the timeout for each attempt, bounded
  retry, same-host redirects, and each failure the fetch layer reports.

The CLI follows the [Command Line Interface Guidelines](https://clig.dev):

- Data goes to stdout. Logs go to stderr.
- `--json` works everywhere.
- `-o` writes to a file.
- Parsing is forgiving.
- `--help` is helpful.
- `doctor` checks your setup.

## Development

This project is built test-first. `mise.toml` pins the toolchain.
In a fresh clone, run `mise trust ./mise.toml` once first.

```bash
mise run ci         # the single CI path: setup→lint→typecheck→build→test→validate
mise run format     # apply formatting (mutating; deliberately OFF the check-only ci spine)
mise run test       # run the bun test suite (real services, no mocks)
bun bin/webular.ts scrape https://example.com --json
```

The suite enforces these rules:

- At most 200 lines per file.
- At most 30 lines per construct.
- Nesting depth of 3 or less.
- No orphaned exports.
- No mocks or stubs.

Tests check real behavior against a local `Bun.serve` fixture. They give the
same result every run and work offline.

Cases that need the live internet (DuckDuckGo search, a real browser) are opt-in:
`WEBULAR_TEST_LIVE=1 mise run test`. DuckDuckGo blocks many datacenter IPs.
The `search --source` and `feed` suites run offline. `WEBULAR_SOURCE_ORIGIN`
points the Wikipedia, Hacker News, and arXiv endpoints at the local fixture.

## License

Apache-2.0 © Kiren Srinivasan. Built on Bun, Mastra, mise, XState,
deepsec, and agent-browser, plus a set of open-source libraries.
