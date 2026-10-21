# bench/tasks/dev/AGENTS.md

The public dev split. The parent rules are in [bench/tasks/AGENTS.md](../AGENTS.md).

## What lives here

- One JSONL file per task family: answer, crawl, fresh, research, scrape, and search.
- Each line is one task with its canary, author, source URL, as-of date, and accepted aliases.

## Rules

- Tune webular only on these tasks.
- A pilot that drops tasks runs here, never on the test split.

## Checks

`mise run test:file tests/bench/set-loader.test.ts`
