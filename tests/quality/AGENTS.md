# tests/quality/AGENTS.md

The code gates. The parent rules are in [tests/AGENTS.md](../AGENTS.md). The rules these gates enforce are in the root [AGENTS.md](../../AGENTS.md).

## What lives here

- Size and exports: `limits.test.ts` (200 lines per file, 30 per function, depth 3), `exports.test.ts` (no export without an importer).
- Language and content: `typescript-only.test.ts`, `no-diagrams.test.ts`, `no-mcp-apps.test.ts`.
- Best practices from `docs/best-practices.md`: `practices-config.test.ts` (CI workflow and package metadata), `practices-source.test.ts` (compiler flags, docs, source patterns).
- The AGENTS.md tree: `agents-md.test.ts` (coverage, shape, size, paths, and tasks), `claude-md-bridges.test.ts` (a real CLAUDE.md beside each AGENTS.md), `rule-greps.test.ts` (rules that one grep can decide), `rule-files.test.ts` (rules that one file read can decide but one grep cannot).
- Coverage and safety: `e2e-parity.test.ts`, `sandbox.test.ts`.
- Code scorers for search and answer factors: `source-trust.eval.test.ts`, `date-recency-scorers.test.ts`, `search-determinism.test.ts`.

## Rules

- Add a gate when code can decide a rule. Name the file after the rule.
- Share analyzers through `tests/_support/`, not between gate files.
- A gate lists every fault at once, not only the first.
- Fix the code a gate flags. Do not loosen the gate.

## Checks

`mise run test:file tests/quality`
