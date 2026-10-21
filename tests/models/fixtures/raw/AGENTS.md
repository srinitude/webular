# tests/models/fixtures/raw/AGENTS.md

This folder holds the raw output of model runs. It follows [tests/models/fixtures/AGENTS.md](../AGENTS.md).

- Each subfolder has the same name as one results file in the parent folder, without the JSON ending.
- The `raw` field of each run in that results file points into its subfolder.
- `tests/models/harness.test.ts` checks that every one of those files exists.
- Do not edit anything here by hand.
