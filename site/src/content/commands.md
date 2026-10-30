# Commands

webular has 22 commands. Each one has its line and an example you can run. `webular <command> --help` lists every flag.

## Find

### `search`

Searches the web with no key, or one keyless source. `--source` also takes `hackernews` and `arxiv`.

```sh
webular search "bun runtime" --source wikipedia
```

### `map`

Finds all URLs for a domain.

```sh
webular map https://example.com
```

### `feed`

Reads an RSS 2.0 or Atom 1.0 feed and lists its items.

```sh
webular feed https://hnrss.org/frontpage --limit 5
```

## Read

### `scrape`

Reads one URL as clean markdown or JSON.

```sh
webular scrape https://example.com --json
```

### `crawl`

Reads a site page by page on the same host.

```sh
webular crawl https://example.com
```

### `batch`

Scrapes many URLs at once.

```sh
webular batch --help
```

### `parse`

Turns local docs into markdown.

```sh
webular parse --help
```

### `media`

Downloads media; takes a screenshot or PDF in a real browser.

```sh
webular media --help
```

## Think

### `extract`

Pulls fields with CSS selectors or a schema.

```sh
webular extract --help
```

### `summarize`

Picks the key sentences (no model).

```sh
webular summarize --text "..." --sentences 1
```

### `answer`

Answers from sources.

```sh
webular answer --help
```

### `research`

Runs a multi-step research loop and writes a cited markdown report.

```sh
webular research "web scraping in 2026" --depth 3 -o report.md
```

## Watch and act

### `monitor`

Tracks changes to a URL over time.

```sh
webular monitor --help
```

### `act`

Drives a real browser.

```sh
webular act --help
```

## Tools and setup

### `doctor`

Checks your setup and toolchain.

```sh
webular doctor --json
```

### `mcp`

Serves webular's features as an MCP server.

```sh
webular mcp
```

### `tasks`

Lists the mise task graph that defines the commands.

```sh
webular tasks
```

### `diagram`

Lists the XState machines that model the CLI flows.

```sh
webular diagram
```

### `audit`

Reports whether `deepsec` is there, plus a scan plan.

```sh
webular audit
```

### `jev`

Learns from recorded Jev calls, or labels one as an eval case.

```sh
webular jev --help
```

### `upgrade`

Prints the command that upgrades this install. `--yes` runs it. Try `webular upgrade`.

### `completions`

Prints the shell completion script for `bash`, `zsh`, `fish`, or `powershell`. Try `webular completions zsh`.

## Global options

`--json`, `--ndjson`, `--select <a,b>`, `-o/--output <file>`, `--timeout <ms>` (per network try), `--no-cache`, `-h/--help`, and `-V/--version`. `--json` prints JSON with sorted keys and a stable shape.

## Exit codes

- `0`: success.
- `1`: failure.
- `2`: usage error.
- `3`: some `batch` items failed.
- `127`: a command could not start.
- `128 + n`: stopped by signal `n` (`130` for SIGINT, `143` for SIGTERM).

## Offline

`summarize --text`, `parse`, `tasks`, `diagram`, and `--help` need no network.
