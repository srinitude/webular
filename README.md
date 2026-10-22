# webular

[![npm](https://img.shields.io/npm/v/webular.svg)](https://www.npmjs.com/package/webular)
[![CI](https://github.com/srinitude/webular/actions/workflows/ci.yml/badge.svg)](https://github.com/srinitude/webular/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/srinitude/webular/badge)](https://scorecard.dev/viewer/?uri=github.com/srinitude/webular)

`webular` is a web research CLI and MCP server. It searches, scrapes, crawls, maps, extracts, summarizes, and answers with sources. It needs one key: Jev (`TYPESAFE_API_KEY`).

With `--json`, every command prints the same JSON shape. Each command is also an MCP tool with the same name.

Built on [Jev](src/lib/jev/AGENTS.md), TypeSafe's System One decision model, for judgment calls; [Mastra](src/workflows/AGENTS.md) workflows; Effect; [XState](src/machines/AGENTS.md) and the Stately agent; Bun; Readability, linkedom, Turndown, unpdf, mammoth, and anydoc for pages; agent-browser and Cua for computer use; and mise's task graph. [Architecture](docs/architecture.md) has the details.

## Why it's different

- It runs on your machine, with no webular server in the middle, and it is open source under Apache-2.0.
- One key: Jev (`TYPESAFE_API_KEY`), reached through the direct TypeSafe endpoint. Without it, each decision falls back to its rule-based baseline.
- One tool covers search, scrape, crawl, map, extract, summarize, answer, and research, as a CLI, an MCP server, a Claude Code plugin, and skills.
- It respects robots.txt by default (`scrape --ignore-robots` opts out). Date-pinned replay with recorded Jev answers gives the same output again; live pages still change.
- Where others are ahead: Exa gives stronger answers, and Exa, Brave, and Google run their own search indexes. [The benchmark results](docs/benchmarks.md) hold every number.

[How it works](docs/how-it-works.md) and [Why webular](docs/why-webular.md) go deeper. To set up the Jev key on any OS, read [Jev in webular](docs/jev.md).

## Why webular

- **No paid API.** Every feature runs on open-source parts.
- **One CLI.** Search, scrape, crawl, map, extract, answer, research, and feed share one command set and one JSON contract.
<!-- bench:start readme -->
- **Measured, not claimed.** On the committed peer run ([peers-2026-10-22T00-58-50-543Z.json](bench/results/peers-2026-10-22T00-58-50-543Z.json)), webular search scored 1.000 on 4 search tasks, while exa scored 1.000 on 4 and firecrawl scored 1.000 on 4. Read [the benchmark results](docs/benchmarks.md) for every score and the method behind it.
- **Agent matrix.** 0 of 75 cells scored: webular with Jev off and on, and 23 alternatives, on 3 agent models. Source: no committed agent run.
<!-- bench:end -->

## Quickstart

Run it once with no install. The first two commands need no network.

```bash
npx webular --help
npx webular summarize --text "Bun is a fast runtime. It runs TypeScript." --sentences 1 --json
npx webular scrape https://example.com --json
```

`bunx webular` and `pnpm dlx webular` work the same way. `webular doctor` checks your setup.

## Install

The npm package is a small Node launcher. It lists eight `webular-<platform>` packages, and npm, Bun, and pnpm install only the one whose `os`, `cpu`, and `libc` fit. Nothing downloads after install.

```bash
npm i -g webular      # needs Node
bun add -g webular    # needs Bun, plus Node on PATH for the launcher
pnpm add -g webular
```

[Install channels](docs/install.md) lists every supported OS, CPU, and libc, and shows how to set `TYPESAFE_API_KEY` in bash, zsh, fish, PowerShell, and cmd. It covers Homebrew, Scoop, winget, release binaries with `SHA256SUMS` and provenance, and the `install.sh` and `install.ps1` scripts. It also covers upgrade, uninstall, and shell completions.

## Use it from an agent

An agent can use webular in three ways. Pick one. Each way runs the same Mastra workflows, and each judgment call inside them goes to Jev, or to a rule-based fallback when no key is set.

- **MCP server.** `webular mcp` serves every command as a tool over stdio. In Claude Code:

  ```bash
  claude mcp add webular -- webular mcp
  ```

  Claude Desktop, Cursor, Windsurf, Cline, and Gemini CLI read this block under `mcpServers`. VS Code uses `servers` instead. [Install channels](docs/install.md#mcp-clients) has the block for each client.

  ```json
  { "mcpServers": { "webular": { "command": "webular", "args": ["mcp"] } } }
  ```

- **Claude Code plugin.** It bundles the MCP server and four skills: research, interview, plain language, and Markdown.

  ```text
  /plugin install webular --marketplace srinitude/webular
  ```

- **Skills only.** Copy a folder from [`plugins/webular/skills`](plugins/webular/skills) into your agent's skills folder. Each skill names only real commands and flags.

The tools are `search`, `scrape`, `map`, `summarize`, `crawl`, `extract`, `answer`, `research`, `jev`, `parse`, `media`, `monitor`, `batch`, `act`, `feed`, `doctor`, `tasks`, `diagram`, and `audit`. Each result holds at most 8,000 characters. A longer one comes back with a `cursor` for the next part. [Agent contract](docs/agent-contract.md) lists what each surface promises. [The plugin README](plugins/webular/README.md) covers the HTTP server for local work.

The `machine.next` tool replays events on one of webular's flow machines (`cliDispatch`, `commandLifecycle`, `fetch`, `jevCommand`, `mcpServe`, or `scrapeFallback`). It returns the machine's state and the events it allows next, using the Stately agent's replay. It calls no model.

## Commands

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
| `jev`       | Learns from recorded Jev calls, or labels one as an eval case |

```bash
webular search "bun javascript runtime" --json
webular search "bun runtime" --source wikipedia --json   # also: hackernews, arxiv
webular feed https://hnrss.org/frontpage --limit 5
webular map https://example.com
webular research "web scraping in 2026" --depth 3 -o report.md
```

`webular <command> --help` lists every flag. [Command reference](docs/commands.md) describes each command.

## Output and exit codes

Global options: `--json`, `--ndjson`, `--select <a,b>`, `-o/--output <file>`, `--timeout <ms>` (per network try), `--no-cache`, `-h/--help`, and `-V/--version`. `--json` prints JSON with sorted keys and a stable shape.

- `0`: success
- `1`: failure
- `2`: usage error
- `3`: some `batch` items failed
- `127`: a command could not start
- `128 + n`: stopped by signal `n` (`130` for SIGINT, `143` for SIGTERM)

## How it behaves

- **robots.txt.** `scrape` returns status `blocked` for a page that robots.txt disallows. `--ignore-robots` fetches one URL anyway and marks it `disallowed`. `crawl`, `map`, and `batch` always honor robots.txt.
- **One optional key.** The only key webular uses is a Jev key, `TYPESAFE_API_KEY`, from TypeSafe or another provider of Jev. Without it, each Jev decision uses its built-in baseline, and every command still runs.
- **Same input, same result.** Pages are cached in `~/.cache/webular`. `WEBULAR_DETERMINISTIC=1` makes search wait for every source. `WEBULAR_AS_OF` pins the run date that answers cite.
- **Offline.** `summarize --text`, `parse`, `tasks`, `diagram`, and `--help` need no network.

[Reliability](docs/reliability.md) covers retries, archive copies, and what happens when a site will not answer.

## Configuration

Every setting is optional and has a default.

- `TYPESAFE_API_KEY`: the Jev key. On macOS, webular also reads it from the Keychain item `typesafe-ai-api-key`. `WEBULAR_JEV=off` turns Jev off.
- `WEBULAR_CACHE_DIR`: the cache folder (default `~/.cache/webular`).
- `WEBULAR_NO_CACHE=1`: fetch every page fresh, the same as `--no-cache`.
- `WEBULAR_DETERMINISTIC=1` and `WEBULAR_AS_OF`: see above.
- `WEBULAR_MAILTO`: an email address for the polite pool of scholarly sources.
- `WEBULAR_TRACE=1`: prints source notes on stderr, such as a spent rate limit.
- `WEBULAR_BIN`: the `webular` binary that the plugin's MCP server calls.

Browser mode uses agent-browser or Cua. Read [Browser mode (Cua)](docs/cua-browser-mode.md) before `scrape --render cua` or `act --goal`.

## Platforms

Prebuilt binaries cover `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `linux-x64-musl`, `linux-arm64-musl`, `windows-x64`, and `windows-arm64`. On any other platform, run from source with Bun.

## Develop

Install [mise](https://mise.jdx.dev). It pins Bun and every other tool.

```bash
mise trust ./mise.toml
mise run setup                          # frozen-lockfile install
mise run test:file tests/contract       # one folder; the full `mise run test` is slow
mise run                                # the whole CI chain
```

Agents start at [AGENTS.md](AGENTS.md). People start at [CONTRIBUTING.md](CONTRIBUTING.md). [Development](docs/development.md) covers build rules and live-internet tests. [Architecture](docs/architecture.md) shows how a command runs.

## Troubleshooting

- Run `webular doctor --json` first. It names each missing tool.
- Exit code `127` means a helper tool is missing. Install it, or run `doctor`.
- For a dead page or a site that will not answer, read [Reliability](docs/reliability.md).

## Project

- Security: report a flaw privately through [Report a vulnerability](https://github.com/srinitude/webular/security/advisories/new). See [SECURITY.md](SECURITY.md).
- Changes: [CHANGELOG.md](CHANGELOG.md) and [GitHub releases](https://github.com/srinitude/webular/releases).
- Help: [SUPPORT.md](SUPPORT.md). Rules: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [GOVERNANCE.md](GOVERNANCE.md).
- Cite: [CITATION.cff](CITATION.cff).
- License: Apache-2.0 © Kiren Srinivasan. See [LICENSE](LICENSE).
