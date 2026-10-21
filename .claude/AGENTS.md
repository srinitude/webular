# .claude/AGENTS.md

Claude Code project settings; the root [AGENTS.md](../AGENTS.md) holds the repo-wide rules.

## What lives here

- `.claude/settings.json`: registers the Jev docs gate hook on file edits.
- `.claude/jev-docs-proof.json`: the proof of the last full read of the TypeSafe docs.

## Rules

- Before an edit to Jev code, the gate asks for a fresh docs proof. Run `mise run jev:docs` to refresh it.
- Every hook sets a `timeout`.

## Children

- [hooks/AGENTS.md](hooks/AGENTS.md)
