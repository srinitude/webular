# src/release/AGENTS.md

Rules for the release steps, under [src/AGENTS.md](../AGENTS.md).

## What lives here

- Package files built from `dist/bin/SHA256SUMS`: [`distribution.ts`](distribution.ts) (Homebrew and Scoop), [`aur.ts`](aur.ts) (Arch), [`nix.ts`](nix.ts) (Nix), [`distros.ts`](distros.ts) (Arch and Nix together), and [`winget.ts`](winget.ts).
- npm: [`platform-packages.ts`](platform-packages.ts) makes one package per target. [`node-launcher.ts`](node-launcher.ts) is the `bin` behind the root package. [`dist-tag.ts`](dist-tag.ts) picks the npm dist-tag.
- Docs and shells: [`completions.ts`](completions.ts) writes shell completions. [`manpage.ts`](manpage.ts) writes the manual page.
- Upgrades: [`upgrade.ts`](upgrade.ts) names the install channel an executable came from and the command that upgrades it.

## Rules

- Each step is a script that a `mise` task runs (see `package:*` and `compile:all` in [`mise.toml`](../../mise.toml)). Run it through that task.
- Steps read checksums from `dist/bin/SHA256SUMS` and write only under `dist/`. Never edit `dist/` by hand.
- Targets come from the one table in [`src/core/platform.ts`](../core/platform.ts). Never list a platform again here.
- Completions and the manual page read the command list and flags from the code. Never type them out.
- [`upgrade.ts`](upgrade.ts) is pure. Callers pass the paths and the environment, so each channel is provable without touching the machine.
- [`node-launcher.ts`](node-launcher.ts) runs on plain Node, so it uses only Node built-ins.
- Publishing to a package manager stays a manual step.

## Checks

```bash
mise run test:file tests/release
```
