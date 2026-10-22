# tests/release/AGENTS.md

Tests for packaging and release. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- Package and install: [`npm-pack.test.ts`](npm-pack.test.ts), [`install.test.ts`](install.test.ts), [`install-ps1.test.ts`](install-ps1.test.ts), [`upgrade.test.ts`](upgrade.test.ts).
- Distribution files: [`distribution.test.ts`](distribution.test.ts), [`distros.test.ts`](distros.test.ts), [`manifests.test.ts`](manifests.test.ts), [`winget.test.ts`](winget.test.ts), [`completions.test.ts`](completions.test.ts), [`manpage.test.ts`](manpage.test.ts).
- Release workflow: [`gates.test.ts`](gates.test.ts) (the Node launcher, build before pack, tag gate), [`assets-job.test.ts`](assets-job.test.ts).

## Rules

- These tests read the workflows in `.github/workflows/` and the generators in [`src/release/`](../../src/release/). Changing a workflow needs a yes first.
- Nothing here publishes or pushes. Tests check files and local runs only.

## Checks

`mise run test:file tests/release`
