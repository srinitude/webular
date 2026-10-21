# bench/tasks/test/AGENTS.md

The sealed test split. The parent rules are in [bench/tasks/AGENTS.md](../AGENTS.md).

## What lives here

- One JSONL file per task family: answer, crawl, fresh, research, scrape, and search.
- These tasks score webular. They never tune it.

## Rules

- Never read these files from webular code or prompts.
- Never write a list of misses on this split where tuning can read it.

## Checks

`mise run test:file tests/bench/set-loader.test.ts`
