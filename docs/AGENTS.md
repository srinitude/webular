# docs/AGENTS.md

User and developer docs; the root [AGENTS.md](../AGENTS.md) holds the repo-wide rules.

## What lives here

- `docs/agent-contract.md`: what an agent needs from the CLI, MCP server, plugin, and skills. `tests/contract/` checks each item.
- `docs/best-practices.md`: each practice webular follows, with its source and the test that checks it.
- `docs/development.md`, `docs/build-and-run.md`, and `docs/install.md`: how to build, test, and install.
- `docs/commands.md`, `docs/architecture.md`, `docs/reliability.md`, and `docs/cua-browser-mode.md`: reference pages.

## Rules

- A behavior change updates the page that describes it in the same commit.
- Each item in `docs/best-practices.md` names its source, the source's date, and its check.
- No diagrams. Link the XState machine in `src/machines/` instead.
- Docs use American English and plain words.
- Docs name the exact command each shipped manifest runs. Source: [Agent Plugins 1.0.0, section 7.2.1](https://agent-plugins.org/specification).
- `docs/install.md` links the plugin README for agent-host setup. Source: [Cursor plugins reference](https://cursor.com/docs/reference/plugins).
- An install line that uses `/plugin install webular --marketplace` needs Claude Code `2.1.275` or a higher build. Source: [Claude Code plugin install, CC 2.1.306](https://code.claude.com/docs/en/plugins/install).
- `docs/commands.md` gives each command's robots.txt stance. Crawl obeys robots.txt and paces its requests. Scrape, batch, and `web.fetch` are user-directed and skip it. Source: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309).
- A page that cites a standard names its version. Source: [Agent Skills specification](https://agentskills.io/specification).
- The page that covers server.json also says how to publish and check the MCP Registry entry. Source: [MCP Registry server.json, schema 2025-12-11](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/draft/server.schema.json).

## Checks

```bash
mise run test:file tests/quality tests/contract
```

- docs/install.md:1-3 never links plugins/webular/README.md.
- docs/commands.md:12 says crawl has no robots.txt or rate limits, but src/lib/polite-crawler.ts obeys robots.txt and paces requests.
- plugins/webular/README.md:17 says the app starts bun ./src/server.ts, but plugins/webular/mcp.json runs ./dist/server.js.
