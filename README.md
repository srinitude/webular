# webular

[![CI](https://github.com/srinitude/webular/actions/workflows/ci.yml/badge.svg)](https://github.com/srinitude/webular/actions/workflows/ci.yml)
[![CodeQL](https://github.com/srinitude/webular/actions/workflows/codeql.yml/badge.svg)](https://github.com/srinitude/webular/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/srinitude/webular/badge)](https://scorecard.dev/viewer/?uri=github.com/srinitude/webular)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15797/badge)](https://www.bestpractices.dev/projects/15797)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Search, scrape, crawl, and answer with sources, from your own machine. A CLI and MCP server with one optional key: Jev.

```console
$ webular search "bun javascript runtime" --limit 2
1. Bun: Fast JavaScript runtime, bundler, transpiler and package manager
   https://github.com/Jarred-Sumner/bun
   https://news.ycombinator.com/item?id=31993622
2. Bun: Fast JavaScript runtime, transpiler, and NPM client written in Zig
   https://bun.sh/?launch
   https://news.ycombinator.com/item?id=31993429
```

That search ran with no key. webular is also an MCP server, an agent plugin, and a set of skills. With `--json`, every command prints the same JSON shape.

## Why webular

- **No paid API.** Every feature runs on open-source parts, on your machine, with no webular server in the middle. It is open source under Apache-2.0.
- **One optional key.** Jev (`TYPESAFE_API_KEY`), reached through the direct TypeSafe endpoint, sharpens the judgment calls. Without it, each decision falls back to its rule-based baseline.
- **One tool.** Search, scrape, crawl, map, extract, summarize, answer, research, and feed share one command set and one JSON contract.
- **Polite and repeatable.** It respects robots.txt by default (`scrape --ignore-robots` opts out). A date-pinned replay with recorded Jev answers can give the same output again, but live pages still change.

[Why webular](docs/why-webular.md) goes deeper.

## How it compares

| Tool | Key needed | Where it runs | In the committed peer run |
|---|---|---|---|
| webular | None (Jev is optional) | Your machine | Scored |
| Exa | Yes | Hosted API with its own search index | Scored |
| Firecrawl | Yes | Hosted API | Scored |
| Tavily | Yes | Hosted API | No scored calls |
| Perplexity | Yes | Hosted API | No scored calls |

<!-- bench:start readme -->
- **Measured, not claimed.** In [the peer run from Oct. 22, 2026 at 17:42 UTC](bench/results/peers-2026-10-22T17-42-50-204Z.json), webular search scored 1.000 on 4 search tasks, while exa scored 1.000 on 4 and firecrawl scored 1.000 on 4. A score of 1 means every answer was right. Webular is even with the best rival, exa. Read [the benchmark results](docs/benchmarks.md) for every score and the method behind it.
- **Agent matrix.** 18 of 75 cells scored: webular with Jev off and on, and 23 alternatives, on 3 agent models. A cell is one tool used by one AI agent model; the rest were skipped for lack of a key or an agent adapter. Source: the agent run from Oct. 22, 2026 at 06:24 UTC.
<!-- bench:end -->

Where others are ahead: Exa, Brave, and Google run their own search indexes, and Exa reports citation precision, which webular does not measure in that run. [Peer benchmarks](docs/benchmarks-peers.md) has each rival's row, and [the benchmarks guide](docs/benchmarks-guide.md) explains every metric.

## Install

macOS and Linux:
```bash
curl --proto '=https' --tlsv1.2 -fsSL https://webular.dev/install.sh | sh
```
Windows (PowerShell):
```powershell
irm https://webular.dev/install.ps1 | iex
```

The script picks the build for your OS, CPU, and libc, and the no-AVX2 build on older x64 CPUs. It checks the SHA-256 baked into it before it installs, and installs nothing on a mismatch. With `gh` on your PATH, it also checks the build's attestation. [The install script guide](docs/install-script.md) shows how to read it first, pin a release with `--version`, and uninstall. With Node, `npm i -g webular` installs it, and `npx webular doctor` runs it once without installing. [Install channels](docs/install.md) covers npm, `npx`, `bunx`, `pnpm dlx`, Homebrew, Scoop, running from source with [Bun](https://bun.sh), [GitHub Packages](docs/install.md#from-github-packages), release binaries with `SHA256SUMS` and provenance, upgrade, and shell completions.

## Quickstart

1. Check your setup. `doctor` names each missing tool (trimmed output):

   ```console
   $ webular doctor
   ok   network HTTP 200
   ok   upgrade https://github.com/srinitude/webular/releases/latest
   ok   jev off (WEBULAR_JEV=off)
   ```

2. Read a page as clean markdown:

   ```console
   $ webular scrape https://example.com
   # Example Domain

   This domain is for use in documentation examples without needing permission. This is not a service; avoid relying on it for testing and monitoring purposes.
   ```

3. Summarize text with no network and no model:

   ```console
   $ webular summarize --text "Bun is a fast runtime. It runs TypeScript." --sentences 1 --json
   {"figures":[],"picks":[{"end":22,"index":0,"source_url":null,"start":0,"text":"Bun is a fast runtime."}],"sentences":["Bun is a fast runtime."],"source_url":null,"summary":"Bun is a fast runtime."}
   ```

## Keys

- **No key:** every command runs. Each Jev decision uses its built-in baseline.
- **Jev key:** set `TYPESAFE_API_KEY`, from TypeSafe or another provider of Jev. On macOS, webular also reads the Keychain item `typesafe-ai-api-key`. `WEBULAR_JEV=off` turns Jev off.

```bash
security add-generic-password -a "$USER" -s typesafe-ai-api-key -w   # macOS Keychain
read -rs TYPESAFE_API_KEY && export TYPESAFE_API_KEY                  # this shell only
```

[Jev in webular](docs/jev.md) shows the setup for every OS and shell.

## Commands

| Command | What it does | Example |
|---|---|---|
| `search`    | Searches the web with no key, or one keyless source | `webular search "bun runtime" --source wikipedia` |
| `scrape`    | Reads one URL as clean markdown or JSON | `webular scrape https://example.com --json` |
| `crawl`     | Reads a site page by page on the same host | `webular crawl https://example.com` |
| `map`       | Finds all URLs for a domain | `webular map https://example.com` |
| `extract`   | Pulls fields with CSS selectors or a schema | `webular extract --help` |
| `summarize` | Picks the key sentences (no model) | `webular summarize --text "..." --sentences 1` |
| `answer`    | Answers from sources | `webular answer --help` |
| `research`  | Runs a multi-step research loop → cited markdown report | `webular research "web scraping in 2026" --depth 3 -o report.md` |
| `parse`     | Turns local docs into markdown | `webular parse --help` |
| `media`     | Downloads media; takes a screenshot or PDF in a real browser | `webular media --help` |
| `monitor`   | Tracks changes to a URL over time | `webular monitor --help` |
| `batch`     | Scrapes many URLs at once | `webular batch --help` |
| `doctor`    | Checks your setup and toolchain | `webular doctor --json` |
| `tasks`     | Lists the mise task graph that defines the commands | `webular tasks` |
| `mcp`       | Serves webular's features as an MCP server | `webular mcp` |
| `diagram`   | Lists the XState machines that model the CLI flows | `webular diagram` |
| `audit`     | Reports whether `deepsec` is there, plus a scan plan | `webular audit` |
| `act`       | Drives a real browser | `webular act --help` |
| `feed`      | Reads an RSS 2.0 or Atom 1.0 feed and lists its items | `webular feed https://hnrss.org/frontpage --limit 5` |
| `upgrade`   | Prints the upgrade command for your install; `--yes` runs it | `webular upgrade` |
| `completions` | Prints a shell completion script | `webular completions zsh` |
| `jev`       | Learns from recorded Jev calls, or labels one as an eval case | `webular jev --help` |

`search --source` also takes `hackernews` and `arxiv`. `webular <command> --help` lists every flag. [Command reference](docs/commands.md) describes each command.

## Use it from an agent

Each way runs the same Mastra workflows, and each judgment call inside them goes to Jev, or to a rule-based fallback when no key is set.

- **MCP server.** `webular mcp` serves every command as a tool over stdio. Most clients read this block under `mcpServers`; VS Code uses `servers` instead:

  ```json
  { "mcpServers": { "webular": { "command": "webular", "args": ["mcp"] } } }
  ```

  In Claude Code, run `claude mcp add webular -- webular mcp`. In Codex CLI, run `codex mcp add webular -- webular mcp`. [Install channels](docs/install.md#mcp-clients) has the setup for Claude Desktop, Cursor, Windsurf, Cline, Gemini CLI, VS Code, and Zed.

- **Agent plugin.** It bundles the MCP server and four skills: research, interview, plain language, and Markdown. In Claude Code, run `/plugin install webular --marketplace srinitude/webular`.
- **Skills only.** Copy a folder from [`plugins/webular/skills`](plugins/webular/skills) into your agent's skills folder. Each skill names only real commands and flags.

The plugin's server has 19 command tools: every command but `mcp`. `webular mcp` has 24 MCP tools: those 19, `machine.next`, and four low-level HTML tools (`web.fetch`, `web.links`, `web.markdown`, and `web.readability`). Each result holds at most 8,000 characters; a longer one comes back with a `cursor` for the next part. `machine.next` replays events on one of webular's flow machines (`cliDispatch`, `commandLifecycle`, `fetch`, `jevCommand`, `mcpServe`, or `scrapeFallback`) and returns its state and allowed next events, with no model call. [Agent contract](docs/agent-contract.md) lists what each surface promises. [The plugin README](plugins/webular/README.md) covers the HTTP server for local work.

## How it works

- **[Jev](src/lib/jev/AGENTS.md)**, TypeSafe's System One decision model, makes the judgment calls inside each command. A System One model gives a fast, typed answer to one narrow question.
- **[Mastra](src/workflows/AGENTS.md)** workflows run each command as a series of steps.
- **Effect** is the base of all the code, so errors and config are typed values the code must handle.
- **[XState](src/machines/AGENTS.md)** machines, with the Stately agent, model each CLI flow so it can be tested and replayed.

Bun runs it. Readability, linkedom, Turndown, unpdf, mammoth, and anydoc read pages. agent-browser and Cua drive real browsers and apps. mise's task graph runs the builds and checks. [How it works](docs/how-it-works.md) and [Architecture](docs/architecture.md) have the details. The [docs index](docs/README.md) links every doc.

## Output, exit codes, and behavior

Global options: `--json`, `--ndjson`, `--select <a,b>`, `-o/--output <file>`, `--timeout <ms>` (per network try), `--no-cache`, `-h/--help`, and `-V/--version`. `--json` prints JSON with sorted keys and a stable shape. Exit codes: `0` success, `1` failure, `2` usage error, `3` some `batch` items failed, `127` a command could not start, and `128 + n` stopped by signal `n` (`130` for SIGINT, `143` for SIGTERM).

- **robots.txt.** `scrape` returns status `blocked` for a page that robots.txt disallows. `--ignore-robots` fetches one URL anyway and marks it `disallowed`. `crawl`, `map`, and `batch` always honor robots.txt.
- **Same input, same result.** Pages are cached in `~/.cache/webular`. `WEBULAR_DETERMINISTIC=1` makes search wait for every source. `WEBULAR_AS_OF` pins the run date that answers cite.
- **Offline.** `summarize --text`, `parse`, `tasks`, `diagram`, and `--help` need no network.
- **Settings.** All optional: `WEBULAR_CACHE_DIR` (default `~/.cache/webular`), `WEBULAR_NO_CACHE=1` (same as `--no-cache`), `WEBULAR_MAILTO` (an email for the polite pool of scholarly sources), `WEBULAR_TRACE=1` (source notes on stderr, such as a spent rate limit), and `WEBULAR_BIN` (the binary the plugin's MCP server calls).

Browser mode uses agent-browser or Cua; read [Browser mode (Cua)](docs/cua-browser-mode.md) before `scrape --render cua` or `act --goal`. [Reliability](docs/reliability.md) covers retries, archive copies, and sites that will not answer.

## Platforms

Prebuilt binaries cover `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `linux-x64-musl`, `linux-arm64-musl`, `windows-x64`, and `windows-arm64`. Each x64 build has a `-baseline` sibling for CPUs without AVX2: `darwin-x64-baseline`, `linux-x64-baseline`, `linux-x64-musl-baseline`, and `windows-x64-baseline`. The installers pick it for you. On any other platform, run from source with Bun.

## Troubleshooting

- Run `webular doctor --json` first. It names each missing tool.
- Exit code `127` means a helper tool is missing. Install it, or run `doctor`.
- For a dead page or a site that will not answer, read [Reliability](docs/reliability.md).

## Contributing

Install [mise](https://mise.jdx.dev). It pins Bun and every other tool.

```bash
mise trust ./mise.toml
mise run setup                          # frozen-lockfile install
mise run test:file tests/contract       # one folder; the full `mise run test` is slow
mise run                                # the whole CI chain
```

People start at [CONTRIBUTING.md](CONTRIBUTING.md); agents start at [AGENTS.md](AGENTS.md). [Development](docs/development.md) covers build rules and live-internet tests.

## Community

- Questions and help: [SUPPORT.md](SUPPORT.md) and [GitHub issues](https://github.com/srinitude/webular/issues).
- Rules: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [GOVERNANCE.md](GOVERNANCE.md).
- Security: report a flaw privately through [Report a vulnerability](https://github.com/srinitude/webular/security/advisories/new). See [SECURITY.md](SECURITY.md).
- Changes: [CHANGELOG.md](CHANGELOG.md) and [GitHub releases](https://github.com/srinitude/webular/releases). Cite: [CITATION.cff](CITATION.cff).

## License

Apache-2.0 © Kiren Srinivasan. See [LICENSE](LICENSE).
