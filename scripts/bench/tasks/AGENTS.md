# scripts/bench/tasks/AGENTS.md

The task-set generators. The parent rules are in [scripts/bench/AGENTS.md](../AGENTS.md). [bench/tasks/AGENTS.md](../../../bench/tasks/AGENTS.md) describes the sets they write.

## What lives here

- One generator per family (answer, crawl, fresh, research, scrape, search), named generate-FAMILY.ts. Helpers are named generate-FAMILY-PART.ts, and each family has a test beside it.
- [generate-common.ts](generate-common.ts): the canary, the task record, the exact 30/35/35 split per family, and the JSONL writer.
- [manifest.ts](manifest.ts): writes the set manifest with the sha256 of every committed dev and test file.
- [private-crypt.sh](private-crypt.sh): encrypts the private split into one archive outside git. The passphrase comes from the macOS Keychain.
- [generate-peers.ts](generate-peers.ts) writes the 28-task peer set from [peers-seed.json](peers-seed.json); [generate-peers.test.ts](generate-peers.test.ts) checks its categories, gold answers, and aliases.
- The JSON files hold the seeds, plans, and templates the generators read.

## Rules

- Run manifest.ts after any generator run.
- Never commit the private split or its archive.
- A test that needs the private split uses `test.skipIf` and names the missing file in its title.

## Checks

`mise run test:file scripts/bench/tasks`
