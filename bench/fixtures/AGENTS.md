# bench/fixtures/AGENTS.md

Local pages and sites the benchmark serves. The parent rules are in [bench/AGENTS.md](../AGENTS.md).

## What lives here

- [server.ts](server.ts): serves this whole tree by path. It answers /r/ paths with a 301, and its robots.txt blocks the robots-blocked pages. Unknown paths get a 404.
- [pages/](pages/): single pages, one folder per page kind. [generate-scrape.ts](../../scripts/bench/tasks/generate-scrape.ts) writes them.
- [sites/](sites/): multi-page sites for crawl and map tasks. [generate-crawl.ts](../../scripts/bench/tasks/generate-crawl.ts) writes them.

## Rules

- Change a page or site through its generator, never by hand.
- The page and site trees are exempt from AGENTS.md coverage. The server serves every file in them, so an extra file would change crawl and scrape results.

## Checks

`mise run test:file scripts/bench/tasks`

## Children

None. The page and site trees are exempt.
