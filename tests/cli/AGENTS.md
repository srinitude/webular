# tests/cli/AGENTS.md

Tests for the CLI edge. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- Dispatch: `dispatch.test.ts` (the committed table matches `mise.toml`; exit codes pass through), `gateway.test.ts` (starts every command with no `mise` on PATH).
- Errors and exit codes: `exit-codes.test.ts` (each tagged error maps to the documented code), `experience-gaps.test.ts` (errors name the next step; `--help` ends with an example).
- Output: `render.test.ts` (human text against `--json`, `-o`, batch exit codes), `human-output.test.ts` (color rule, width wrap, "did you mean").

## Rules

- The exit codes follow [docs/agent-contract.md](../../docs/agent-contract.md). Do not change one without asking first.
- Real runs use `bin/webular.ts` on a pipe.

## Checks

`mise run test:file tests/cli`
