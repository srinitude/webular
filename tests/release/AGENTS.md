# tests/release/AGENTS.md

Tests for packaging and release. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- Package and install: [`npm-pack.test.ts`](npm-pack.test.ts), [`install.test.ts`](install.test.ts) (against a `Bun.serve` fake release), [`install-asset.test.ts`](install-asset.test.ts) (every OS, CPU, libc, and AVX2 asset pick), [`install-ps1.test.ts`](install-ps1.test.ts), [`upgrade.test.ts`](upgrade.test.ts).
- Clean-cache start: [`bunx-mcp-start.test.ts`](bunx-mcp-start.test.ts) runs `bunx webular@latest mcp` with an empty Bun cache; it needs `WEBULAR_TEST_LIVE=1`.
- Distribution files: [`distribution.test.ts`](distribution.test.ts), [`distros.test.ts`](distros.test.ts), [`nix-refresh.test.ts`](nix-refresh.test.ts) (the `nix:check` lag flag), [`manifests.test.ts`](manifests.test.ts), [`winget.test.ts`](winget.test.ts), [`completions.test.ts`](completions.test.ts), [`manpage.test.ts`](manpage.test.ts), [`description-sync.test.ts`](description-sync.test.ts) (every description surface copies the [`package.json`](../../package.json) description; the marketplace plugin entry copies [`plugins/webular/plugin.json`](../../plugins/webular/plugin.json)).
- Plugin and pack files: [`mcp-manifests.test.ts`](mcp-manifests.test.ts), [`pack-list.test.ts`](pack-list.test.ts).
- Release workflow: [`gates.test.ts`](gates.test.ts) (the Node launcher, build before pack, tag gate), [`assets-job.test.ts`](assets-job.test.ts), [`github-packages.test.ts`](github-packages.test.ts) (the GitHub Packages job and the rename).
- Release file names: [`release-file-names.test.ts`](release-file-names.test.ts) (the list in [`docs/install-more.md`](../../docs/install-more.md) matches every file the release workflow attaches).

## Rules

- These tests read the workflows in `.github/workflows/` and the generators in [`src/release/`](../../src/release/). Changing a workflow needs a yes first.
- Nothing here publishes or pushes. These tests check files and local runs only.
- Baseline targets are exempt from the Homebrew, Scoop, winget, and Dockerfile checks; they have their own npm package and asset checks.

## Checks

`mise run test:file tests/release`
