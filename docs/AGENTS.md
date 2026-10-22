# docs/AGENTS.md

User and developer docs. The root [AGENTS.md](../AGENTS.md) holds the repo-wide rules.

## What lives here

- [`docs/README.md`](README.md): the docs index. It links every doc.
- [`docs/agent-contract.md`](agent-contract.md): what an agent needs from the CLI, MCP server, plugin, and skills. [`tests/contract/`](../tests/contract/) checks each item.
- [`docs/best-practices.md`](best-practices.md): each practice webular follows, with its source and the test that checks it.
- [`docs/development.md`](development.md), [`docs/build-and-run.md`](build-and-run.md), and [`docs/install.md`](install.md): how to build, test, and install.
- [`docs/tasks.md`](tasks.md): every `mise` task, written by `mise run docs:tasks`.
- [`docs/commands.md`](commands.md), [`docs/architecture.md`](architecture.md), [`docs/reliability.md`](reliability.md), and [`docs/cua-browser-mode.md`](cua-browser-mode.md): reference pages.
- [`docs/jev.md`](jev.md): how to set up the Jev key on any OS, and each route to Jev that webular supports.
- [`docs/how-it-works.md`](how-it-works.md) and [`docs/why-webular.md`](why-webular.md): how webular works inside, and why to pick it.
- [`docs/research-factors.md`](research-factors.md): each web-research factor, with the code and test that guard it or the gap that stays open.
- [`docs/benchmarks.md`](benchmarks.md): the public benchmark report. Every number in it names the committed result file it comes from.
- [`docs/benchmarks-peers.md`](benchmarks-peers.md): the full comparison with each peer, and its notes. `mise run bench:docs` writes its numbers.
- [`benchmarks-guide.md`](benchmarks-guide.md), [`benchmarks-method.md`](benchmarks-method.md): the reading guide and the method.
- [`docs/command-parity.md`](command-parity.md): each command's rival endpoints, whether the peer bench scores it, and the metric that fits.
- [`docs/scoreboard.md`](scoreboard.md): the scoreboard table, written by `mise run bench:scoreboard`.
- [`docs/bug-classes.md`](bug-classes.md): each kind of bug webular can hit, where, its guard, and its sources, plus the before-you-merge checklist.
- [`docs/research/`](research/): the paper ledger and one ranked change list per topic. Its [`README.md`](research/README.md) gives the counts. [`docs/research.md`](research.md) marks each ranked change applied, rejected, or open.

## Rules

- A behavior change updates the page that describes it in the same commit.
- Adding a guard or fixing a bug class updates [`docs/bug-classes.md`](bug-classes.md).
- Each item in [`docs/best-practices.md`](best-practices.md) names its source, the source's date, and its check.
- No diagrams. Link the XState machine in [`src/machines/`](../src/machines/) instead.
- Docs use American English and plain words.
- Docs name the exact command each shipped manifest runs. Source: [Agent Plugins 1.0.0, section 7.2.1](https://agent-plugins.org/specification).
- [`docs/install.md`](install.md) links the plugin README for agent-host setup. Source: [Cursor plugins reference](https://cursor.com/docs/reference/plugins).
- An install line that uses `/plugin install webular --marketplace` needs Claude Code `2.1.275` or a higher build. Source: [Claude Code plugin install, CC 2.1.306](https://code.claude.com/docs/en/plugins/install).
- [`docs/commands.md`](commands.md) gives each command's robots.txt stance. Crawl obeys robots.txt and paces its requests. Scrape returns status "blocked" for a disallowed page unless `--ignore-robots` is set. Batch always honors robots.txt. `web.fetch` is user-directed and skips it. Source: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309).
- A page that cites a standard names its version. Source: [Agent Skills specification](https://agentskills.io/specification).
- The page that covers server.json also says how to publish and check the MCP Registry entry. Source: [MCP Registry server.json, schema 2025-12-11](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/draft/server.schema.json).

## Checks

```bash
mise run test:file tests/quality tests/contract
```
