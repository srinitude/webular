# tests/fixtures/AGENTS.md

This folder holds the shared stored files that tests read, under the rules in [tests/AGENTS.md](../AGENTS.md).

- Each loose JSON file is one stored answer body from a search source: `tests/fixtures/crossref-works.json`, `tests/fixtures/openalex-works.json`, and `tests/fixtures/wikipedia-uncertainty-riddle.json`.
- `tests/engine/search-chain.test.ts` reads the Crossref file. `tests/engine/search-hop.test.ts` reads the riddle file.
- Each subfolder holds the files for one area: `tests/fixtures/cua`, `tests/fixtures/driver`, `tests/fixtures/jev-docs`, and `tests/fixtures/sources`.
- These files stand for what a real service sent back. Do not edit one by hand to make a test pass. Add a second file for a second case.
