# bench/tasks/AGENTS.md

The frozen benchmark task sets. The parent rules are in [bench/AGENTS.md](../AGENTS.md). [README.md](README.md) says how to set up and encrypt the private split.

## What lives here

- [dev/](dev/): the public dev split, one JSONL file per task family. Use it for tuning.
- [test/](test/): the sealed test split, with the same families. Use it only for scoring.
- [manifest.json](manifest.json): the set version and the sha256 of every committed dev and test file. The loader refuses a file whose bytes changed.
- [LICENSES.md](LICENSES.md) and [SOURCES.md](SOURCES.md): set licenses, sources, and known limits.
- The private split, 30% of each family, sits in a gitignored folder here. It never enters git or the manifest.

## Rules

- Write task files only through the generators in [scripts/bench/tasks/](../../scripts/bench/tasks/). Then rerun [manifest.ts](../../scripts/bench/tasks/manifest.ts).
- Never hand-edit a JSONL line. The loader fails on one changed byte.
- Keep the private split gitignored. Tests that read it skip when it is missing.
- Never commit results or recordings next to the tasks.

## Checks

`mise run test:file tests/bench/set-loader.test.ts scripts/bench/tasks`

## Children

- [dev/AGENTS.md](dev/AGENTS.md)
- [test/AGENTS.md](test/AGENTS.md)
