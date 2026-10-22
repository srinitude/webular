# plugins/webular/scripts/AGENTS.md

This folder holds the check scripts that the `plugin:` tasks run. The plugin rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- [lib.ts](lib.ts) holds the shared helpers: file walking, Markdown scanning, and the `run` wrapper.
- One script per check: [check-evals.ts](check-evals.ts), [check-links.ts](check-links.ts), [check-reachable.ts](check-reachable.ts), [check-test-first.ts](check-test-first.ts), [check-timeless.ts](check-timeless.ts), and [code-limits.ts](code-limits.ts).
- [checks.test.ts](checks.test.ts) tests the pure rules of the scripts on in-memory text.

## Rules

- A script returns one `file:line: message` string per violation, and `run` prints them and sets the exit code.
- Export the pure rule of a check so [`checks.test.ts`](checks.test.ts) can test it, and keep the file walk out of that rule.
- [`check-reachable.ts`](check-reachable.ts) skips files named AGENTS.md, because no SKILL.md links them.
- [`code-limits.ts`](code-limits.ts) scans `src`, `tests`, and `scripts` of the plugin.
- [`check-links.ts`](check-links.ts) and [`check-timeless.ts`](check-timeless.ts) scan only Markdown under the plugin folder.

## Checks

- `mise run plugin:code-limits` checks the size limits on these files.
- `mise run plugin:test` runs [`checks.test.ts`](checks.test.ts).
