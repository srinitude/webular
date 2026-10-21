# plugins/webular/scripts/AGENTS.md

This folder holds the check scripts that the `plugin:` tasks run. The plugin rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/scripts/lib.ts` holds the shared helpers: file walking, Markdown scanning, and the `run` wrapper.
- One script per check: `check-evals.ts`, `check-links.ts`, `check-reachable.ts`, `check-test-first.ts`, `check-timeless.ts`, and `code-limits.ts`.
- `plugins/webular/scripts/checks.test.ts` tests the pure rules of the scripts on in-memory text.

## Rules

- A script returns one `file:line: message` string per violation, and `run` prints them and sets the exit code.
- Export the pure rule of a check so `checks.test.ts` can test it. Keep the file walk out of it.
- `check-reachable.ts` skips files named AGENTS.md, because no SKILL.md links them.
- `code-limits.ts` scans `src`, `tests`, and `scripts` of the plugin.

## Checks

- `mise run plugin:code-limits` checks the size limits on these files.
- `mise run plugin:test` runs `checks.test.ts`.
- `plugins/webular/scripts/check-links.ts:54` and `plugins/webular/scripts/check-timeless.ts:31` scan only plugin Markdown. The root AGENTS.md and CLAUDE.md, `llms.txt`, `README.md`, and `docs/*.md` go unchecked, and no `llms.txt` link gets a HEAD request.
