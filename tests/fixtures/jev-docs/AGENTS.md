# tests/fixtures/jev-docs/AGENTS.md

This folder holds the saved Jev docs text, and it follows [tests/fixtures/AGENTS.md](../AGENTS.md).

- `tests/fixtures/jev-docs/llms-full.txt` is a saved copy of the `llms-full.txt` page on docs.typesafe.ai.
- `scripts/jev-docs.ts` reads it to prove that the text still states every limit. The proof lands in `src/lib/jev/docs-snapshot.json`.
- `mise run jev:docs` rewrites it when the live page changed. `mise run jev:docs -- --replay` checks it offline.
- Do not edit it by hand, because the proof hash would stop matching.
