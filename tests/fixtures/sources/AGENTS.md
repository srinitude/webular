# tests/fixtures/sources/AGENTS.md

This folder holds one stored response body for each search source adapter, and it follows [tests/fixtures/AGENTS.md](../AGENTS.md).

- Each file is named for its source and its call, such as [`tests/fixtures/sources/wayback-cdx.json`](wayback-cdx.json) or [`tests/fixtures/sources/site-home.html`](site-home.html).
- The `body` helper in [`tests/lib/sources/support.ts`](../../lib/sources/support.ts) reads them. The adapter tests serve them from a local `Bun.serve` fixture, so no test calls the real service.
- [`tests/commands/search-fallback.test.ts`](../../commands/search-fallback.test.ts) reads two of them for the scholarly fallback.
- The bodies are recorded, not made up. Do not edit one by hand. Record the source again when its shape changes.
