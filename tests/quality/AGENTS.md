# tests/quality/AGENTS.md

The code gates. The parent rules are in [tests/AGENTS.md](../AGENTS.md). These gates enforce the rules in the root [AGENTS.md](../../AGENTS.md).

## What lives here

- Size and exports: [`limits.test.ts`](limits.test.ts) (200 lines per file, 30 per function, depth 3), [`exports.test.ts`](exports.test.ts) (no export without an importer).
- PDF text: [`parse-pdf-fidelity.test.ts`](parse-pdf-fidelity.test.ts) (no running headers or footers, hyphens joined).
- Language and content: [`typescript-only.test.ts`](typescript-only.test.ts), [`no-diagrams.test.ts`](no-diagrams.test.ts), [`no-mcp-apps.test.ts`](no-mcp-apps.test.ts).
- Best practices from [docs/best-practices.md](../../docs/best-practices.md): [`practices-config.test.ts`](practices-config.test.ts) (CI and package metadata), [`practices-source.test.ts`](practices-source.test.ts) (compiler flags, docs, source patterns).
- The command reference: [`commands-doc.test.ts`](commands-doc.test.ts) ([docs/commands.md](../../docs/commands.md), `--help`, and the run tasks name the same commands and flags).
- The AGENTS.md tree: [`agents-md.test.ts`](agents-md.test.ts) (coverage, shape, size, paths, and tasks), [`agents-md-sync.test.ts`](agents-md-sync.test.ts) (file names exist, a folder names its entries within the floor in [`agents-md-gaps.json`](agents-md-gaps.json), env vars, flags, commands, and symbols exist in code, only the Jev key is named), [`markdown-links.test.ts`](markdown-links.test.ts) (the `docs:links` check), [`claude-md-bridges.test.ts`](claude-md-bridges.test.ts) (a real CLAUDE.md beside each AGENTS.md), [`markdown-chain-ledger.test.ts`](markdown-chain-ledger.test.ts) (a row per Markdown file), [`rule-greps.test.ts`](rule-greps.test.ts) (rules one grep decides), [`rule-files.test.ts`](rule-files.test.ts) (rules one file read decides).
- Open items: [`open-items-status.test.ts`](open-items-status.test.ts) (one status each).
- Site: [`site-routes.test.ts`](site-routes.test.ts) (route links exist in the build).
- Docs site: [`docs-content.test.ts`](docs-content.test.ts) (paths, links, footers), [`docs-commands.test.ts`](docs-commands.test.ts) (command pages).
- Host names: [`host-neutral.test.ts`](host-neutral.test.ts) (only adapter files name a host).
- Step abort: [`step-abort-signal.effect.test.ts`](step-abort-signal.effect.test.ts).
- Docs facts: [`readme-facts.test.ts`](readme-facts.test.ts) (the claims in [README.md](../../README.md) and [docs/install.md](../../docs/install.md) match the code).
- Coverage and safety: [`e2e-parity.test.ts`](e2e-parity.test.ts), [`sandbox.test.ts`](sandbox.test.ts), [`sandbox-default.security.test.ts`](sandbox-default.security.test.ts) (agent mode confines output paths), [`only-jev-key.test.ts`](only-jev-key.test.ts) (the code reads only the Jev API key).
- Bug classes from [docs/bug-classes.md](../../docs/bug-classes.md): [`bugs-check.test.ts`](bugs-check.test.ts) plants one bad line per guard in [scripts/bugs-check.ts](../../scripts/bugs-check.ts) and proves each one fails.
- Install: [`installed-deps.test.ts`](installed-deps.test.ts) (declared packages are installed), [`shared-tokens.test.ts`](shared-tokens.test.ts) (one token file).
- Search and answer scorers:
  - [`date-recency-scorers.test.ts`](date-recency-scorers.test.ts): `asOf` is the pinned run date, and the top hit is recent.
  - [`answer-accuracy.eval.test.ts`](answer-accuracy.eval.test.ts): scores the offline dev set for faithfulness, sure-but-wrong, and no-answer rates.
  - [`search-determinism.test.ts`](search-determinism.test.ts): with `WEBULAR_DETERMINISTIC=1`, the same recorded sources give the same ranked hits.

## Rules

- Add a gate when code can decide a rule. Name the file after the rule.
- Share analyzers through [tests/_support/](../_support/), not between gate files.
- A gate lists every fault at once, not only the first.
- Fix the code a gate flags. Do not loosen the gate.

## Checks

`mise run test:file tests/quality`

Install, packaging, limit, and gate-budget bugs: `mise run bugs:tests-build`.
