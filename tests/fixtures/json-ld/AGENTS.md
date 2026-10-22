# tests/fixtures/json-ld/AGENTS.md

This folder holds hand-written JSON-LD pages for the parsing guards, and it follows [tests/fixtures/AGENTS.md](../AGENTS.md).

## What lives here

- [wrapped.html](wrapped.html) wraps JSON-LD blocks in comments, CDATA, a BOM, and trailing commas. [json-ld-tolerant.parsing.test.ts](../../lib/json-ld-tolerant.parsing.test.ts) reads it through `mise run bugs:parsing`.
