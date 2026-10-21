# bin/AGENTS.md

The CLI entry; the root [AGENTS.md](../AGENTS.md) holds the repo-wide rules.

## What lives here

- `bin/webular.ts`: the entry the executable and `bun bin/webular.ts` start. It routes to a command through `src/cli/dispatch-table.ts`.

## Rules

- Keep startup cheap: the entry imports no command code. Each command starts in its own process.

## Checks

```bash
mise run build
mise run test:file tests/cli tests/contract
```
