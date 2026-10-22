# bench/datasets/AGENTS.md

Manifests for public datasets that the bench downloads at run time. The parent rules are in [bench/AGENTS.md](../AGENTS.md). The licenses are in [LICENSES.md](../tasks/LICENSES.md).

## What lives here

- [`webmainbench.json`](webmainbench.json): 100 rows of the WebMainBench 545-row subset file (Apache-2.0), at one pinned Hugging Face revision.
- [`firecrawl-scrape.json`](firecrawl-scrape.json): all 1000 rows of the Firecrawl scrape content dataset (MIT), at one pinned revision.

Each manifest holds the repo, the revision, the file name, its size, its sha256, and how the rows were chosen. It also holds one entry per row: the id, the URL, and the sha256 of the row.

## Rules

- The licenses cover the labels. The pages stay under their owners' copyright. Never commit page content, a downloaded file, or a copy of a row's text.
- Download only through `mise run bench:data`. It saves into the gitignored `.cache/bench-data/<set>/` and fails when a size or sha256 differs from the manifest. A cached file with the right hash makes no network call.
- No CI step may run `bench:data`. Tests use a local fixture and a stub client.
- Row choice: the sets rank rows by the sha256 of the id, and the first N stay. The rule ignores file order and never looks at a webular result.
- Change a manifest only with `mise run bench:data:pin`, after you bump a revision and fetch its file. Never edit one by hand.
- A loader reads a row through `loadRows` in [`scripts/bench/dataset-manifest.ts`](../../scripts/bench/dataset-manifest.ts). It refuses a row whose hash differs.

## Checks

`mise run test:file tests/bench/dataset-fetch.test.ts`

## Children

None.
