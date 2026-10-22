# .cursor-plugin/AGENTS.md

The Cursor plugin marketplace for this repo; the root [AGENTS.md](../AGENTS.md) holds the repo-wide rules, and [.claude-plugin/AGENTS.md](../.claude-plugin/AGENTS.md) holds the marketplace rules.

## What lives here

- `.cursor-plugin/marketplace.json`: the same marketplace as [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json), where Cursor looks for it.

## Checks

```bash
mise run test:file plugins/webular/tests/manifests.test.ts
```
