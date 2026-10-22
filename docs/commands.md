# Command reference

This page describes what each `webular` command does. The README holds the usage line, the global options, the exit codes, and examples.

## Commands

| Command | What it does |
|---|---|
| `search`    | Searches the web with no key, through DuckDuckGo's no-JS HTML page. `--source wikipedia\|hackernews\|arxiv` searches one of those keyless sources instead. When every source fails and nothing is found, the JSON lists each failed source in `errors`, stderr says so, and the command exits 1 |
| `scrape`    | Reads one URL as clean markdown or JSON (Bun.fetch + Readability + Turndown). By default, a page that robots.txt disallows returns status "blocked" with reason "robots". `--ignore-robots` fetches it anyway (single URL only), and the output carries robots: "disallowed". Crawl, map, and batch always honor robots.txt. A host that cannot be reached fails with the network error, not "blocked" |
| `crawl`     | Reads a site page by page on the same host, breadth first. It obeys robots.txt and paces its requests per host. An unreachable robots.txt, one that answers with a server error, blocks the crawl. A host that cannot be reached fails with the network error |
| `map`       | Finds all URLs for a domain (sitemap + link BFS) |
| `extract`   | Pulls fields with CSS selectors or a schema |
| `summarize` | Picks the key sentences (no model) |
| `answer`    | Answers from sources (search → fetch → synthesize). `--urls <url>` reads only the pages you name. Repeat the flag once per URL, so a comma inside a URL stays whole |
| `research`  | Runs a multi-step research loop → cited markdown report |
| `parse`     | Turns local docs into markdown (PDF/DOCX/HTML/CSV/JSON/TXT) |
| `media`     | Downloads media; takes a screenshot or PDF in a real browser (agent-browser) |
| `monitor`   | Tracks changes to a URL over time (diff + bun:sqlite). It obeys robots.txt. When the page does not load, it reads the closest archived copy instead: the JSON names that copy in `archivedFrom`, stderr warns, and the exit code stays 0 |
| `batch`     | Scrapes many URLs at once |
| `doctor`    | Checks your setup and toolchain |
| `tasks`     | Lists the mise task graph that defines the commands |
| `mcp`       | Serves webular's features as an MCP server |
| `diagram`   | Lists the XState machines that model the CLI flows ([src/machines](../src/machines)) |
| `audit`     | Reports whether `deepsec` is there, plus a scan plan (keyless; scans need LLM keys) |
| `act`       | Drives a real browser: open, snapshot, screenshot, interact (agent-browser). With `--goal`, it drives a Cua window (see [Browser mode](cua-browser-mode.md)) |
| `feed`      | Reads an RSS 2.0 or Atom 1.0 feed and lists its items (title, link, date, summary) |
| `jev`       | Learns from recorded Jev calls (`learn`), or labels one call as an eval case (`correct`) |
| `upgrade`   | Prints the command that upgrades this install, from the installer receipt or the install path. `--yes` runs it. `WEBULAR_LATEST_URL` replaces `https://webular.dev/latest` |
| `completions` | Prints the completion script for `bash`, `zsh`, `fish`, or `powershell` |

### Missing fields and missing text

- `--select` with a field the output lacks still prints the fields it has and exits `0`. A stderr note names each missing field and lists the fields there are, for example: `select: no field "titel" in this output; fields: ...`. The check runs after the command ends, so the finished work is never lost.
- `parse` and `scrape` exit `1` on a PDF with no text layer, such as a scanned or image-only PDF. Webular has no OCR, so the error says to run the PDF through an OCR tool, such as `ocrmypdf`, first.
- `answer` and `research` keep a page when Readability finds no main text on it, and read the page's body text instead. A run whose pages load exits `0`, even when another fetch fails.

## Private addresses

Webular guards against requests to your own network (SSRF). A private address is loopback, RFC 1918, link-local such as `169.254.169.254`, CGNAT, IPv6 `::1`, `fc00::/7`, or `fe80::/10`, or an IPv4-mapped IPv6 form of any of them. `localhost` counts too. [`src/core/address-guard.ts`](../src/core/address-guard.ts) applies these rules to every request:

- **You typed it.** A private URL you give on the command line is fetched, so you can scrape your own dev server.
- **Agent mode.** Under `webular mcp` and the agent plugin, page text can steer the agent, so every private target is blocked. Set `WEBULAR_ALLOW_PRIVATE=1` to allow them.
- **Redirects.** A redirect may reach a private address only when the request started on one. A redirect from `https` to `http` is always blocked.
- **Search results.** `answer` and `research` treat a link from a search result page like a redirect from a public page, so a private link is blocked. A URL you pass with `answer --urls` counts as typed.
- **Crawl and map roots.** A root that redirects to another site fails. It never moves the scope. Only a leading `www.` may differ.
- **DNS.** The guard resolves the host and checks every address before it connects. Bun's fetch can't connect to a pinned address, so a DNS answer that changes between the check and the connect (rebinding) is not caught.

`WEBULAR_ALLOW_PRIVATE=1` lifts every private-address block.

## Output paths

Webular can write files: `-o`, `media` downloads, `act` screenshots, and the `monitor` database. [`src/core/safepath.ts`](../src/core/safepath.ts) decides where those files may go:

- **You typed it.** At the command line, a path goes where you say, like `curl -o`.
- **Agent mode.** Under `webular mcp` and the agent plugin, the sandbox is on: a write must stay inside the folder webular started in, or `WEBULAR_OUTPUT_DIR` when you set it. An absolute path, a `..` that climbs out, or a symlink that points out is refused.
- **Your own settings.** `WEBULAR_DB` is yours, not the agent's, so the sandbox leaves it alone.

`WEBULAR_SANDBOX=1` turns the sandbox on at the command line. `WEBULAR_SANDBOX=0` turns it off in agent mode.

### Related pages

- [Browser mode (Cua)](cua-browser-mode.md): read it before `scrape --render cua` or `act --goal`.
- [Reliability](reliability.md): read it for `--archive` and for what happens when a page is dead.
- [Agent contract](agent-contract.md): read it for the `mcp` command, the agent plugin, and its skills.
- [Accuracy scoreboard](scoreboard.md): read it for each command's measured accuracy, the eval behind each number, and the metrics no eval covers yet.

Return to the [README](../README.md) (navigation only).
