# tests/models/baseline/AGENTS.md

Recorded output of each scenario's reference call. The parent rules are in [tests/models/AGENTS.md](../AGENTS.md).

- Each `<scenario id>.txt` is the raw output of one reference webular call against the local fixture. The ids come from [tests/models/scenarios.json](../scenarios.json).
- `bun tests/models/baseline.ts` writes these files and records the pass result in `scenarios.json`.

## Rules

- Never edit a `.txt` file by hand. Run the baseline script instead.
- Each added scenario needs its baseline file, or [harness.test.ts](../harness.test.ts) fails.
- Besides this file and its [`CLAUDE.md`](CLAUDE.md) bridge, the folder holds `.txt` files only. The baseline script and the tests do not list the folder.

## Checks

`mise run test:file tests/models/harness.test.ts`
