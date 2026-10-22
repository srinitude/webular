# bench/tasks/dev/AGENTS.md

The public dev split. The parent rules are in [bench/tasks/AGENTS.md](../AGENTS.md).

## What lives here

- One JSONL file per task family: answer, crawl, fresh, research, scrape, and search.
- [peers.jsonl](peers.jsonl): the live peer benchmark set. It holds single-answer questions in seven categories, and `mise run bench:matrix` runs it. Its sources are in [SOURCES.md](../SOURCES.md).
- Each line is one task with its canary, author, source URL, as-of date, and accepted aliases.

## Rules

- Tune webular only on these tasks.
- A pilot that drops tasks runs here, never on the test split.

## Checks

`mise run test:file tests/bench/set-loader.test.ts`
