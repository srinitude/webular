# .claude/AGENTS.md

Adapter for Claude Code, one agent host among several. The neutral repo-wide rules live in the root [AGENTS.md](../AGENTS.md). This folder only wires the Jev docs gate into Claude Code.

## What lives here

- `.claude/settings.json`: registers the Jev docs gate hook on file edits.
- `.claude/jev-docs-proof.json`: the proof of the last full read of the TypeSafe docs.

## Rules

- Before an edit to Jev code, the gate asks for a fresh docs proof. Run `mise run jev:docs` to refresh it.
- Every hook sets a `timeout`.

## Children

- [hooks/AGENTS.md](hooks/AGENTS.md)
