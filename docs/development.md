# Development

Read this page before you change webular or run its tests.

## Setup and commands

This project is built test-first. [`mise.toml`](../mise.toml) pins the toolchain.
In a fresh clone, run `mise trust ./mise.toml` once first.

```bash
mise run ci         # the single CI path: setup→lint→typecheck→build→test→validate
mise run format     # apply formatting (mutating; deliberately OFF the check-only ci spine)
mise run test       # run the bun test suite (real services, no mocks)
bun bin/webular.ts scrape https://example.com --json
```

## Tests

The suite enforces these rules:

- At most 200 lines per file.
- At most 30 lines per construct.
- Nesting depth of 3 or less.
- No orphaned exports.
- No mocks or stubs.

### How tests run

Tests check real behavior against a local `Bun.serve` fixture. They give the
same result every run and work offline.

### Live-internet cases

Cases that need the live internet (DuckDuckGo search, a real browser) are opt-in:
`WEBULAR_TEST_LIVE=1 mise run test`. DuckDuckGo blocks many datacenter IPs.
The `search --source` and `feed` suites run offline. `WEBULAR_SOURCE_ORIGIN`
points the Wikipedia, Hacker News, and arXiv endpoints at the local fixture.

Return to the [README](../README.md) (navigation only).
