# tests/quality/AGENTS.md

The code gates. Parent rules: [tests/AGENTS.md](../AGENTS.md). They enforce the root [AGENTS.md](../../AGENTS.md).

## What lives here

- Size and exports: [`limits.test.ts`](limits.test.ts) (200 lines per file, 30 per function, depth 3), [`exports.test.ts`](exports.test.ts) (no export without an importer).
- PDF text: [`parse-pdf-fidelity.test.ts`](parse-pdf-fidelity.test.ts) (no running headers or footers, hyphens joined).
- Language and content: [`typescript-only.test.ts`](typescript-only.test.ts), [`no-diagrams.test.ts`](no-diagrams.test.ts), [`no-mcp-apps.test.ts`](no-mcp-apps.test.ts).
- Best practices from [docs/best-practices.md](../../docs/best-practices.md): [`practices-config.test.ts`](practices-config.test.ts) (CI and package metadata), [`practices-source.test.ts`](practices-source.test.ts) (compiler flags, docs, source patterns).
- The command reference: [`commands-doc.test.ts`](commands-doc.test.ts) ([docs/commands.md](../../docs/commands.md), `--help`, and the run tasks agree).
- The AGENTS.md tree: [`agents-md.test.ts`](agents-md.test.ts) (coverage, shape, size, paths, tasks), [`agents-md-sync.test.ts`](agents-md-sync.test.ts) (named files, env vars, flags, commands, and symbols exist; folder floors in [`agents-md-gaps.json`](agents-md-gaps.json); only the Jev key), [`markdown-links.test.ts`](markdown-links.test.ts) (the `docs:links` check), [`claude-md-bridges.test.ts`](claude-md-bridges.test.ts) (a real CLAUDE.md beside each AGENTS.md), [`markdown-chain-ledger.test.ts`](markdown-chain-ledger.test.ts) (a row per Markdown file), [`rule-greps.test.ts`](rule-greps.test.ts) (rules one grep decides), [`rule-files.test.ts`](rule-files.test.ts) (rules one file read decides).
- Open items: [`open-items-status.test.ts`](open-items-status.test.ts) (one status each).
- Site: [`site-routes.test.ts`](site-routes.test.ts) (route links resolve), [`site-copy-failed.test.ts`](site-copy-failed.test.ts) (a failed copy says so), [`shared-tokens.test.ts`](shared-tokens.test.ts) (home and docs share tokens), [`token-sources.test.ts`](token-sources.test.ts), [`control-edge-contrast.test.ts`](control-edge-contrast.test.ts) (control edges keep 3:1).
- Docs site: [`docs-content.test.ts`](docs-content.test.ts) (paths, links, footers), [`docs-commands.test.ts`](docs-commands.test.ts) (command pages).
- Host names: [`host-neutral.test.ts`](host-neutral.test.ts) (only adapter files name a host).
- Step abort: [`step-abort-signal.effect.test.ts`](step-abort-signal.effect.test.ts).
- Docs facts: [`readme-facts.test.ts`](readme-facts.test.ts) (claims in [README.md](../../README.md) and [docs/install.md](../../docs/install.md) match code).
- Coverage and safety: [`e2e-parity.test.ts`](e2e-parity.test.ts), [`sandbox.test.ts`](sandbox.test.ts), [`sandbox-default.security.test.ts`](sandbox-default.security.test.ts) (agent mode confines output paths), [`only-jev-key.test.ts`](only-jev-key.test.ts) (reads only the Jev API key), [`installed-deps.test.ts`](installed-deps.test.ts) (declared packages are installed).
- Bug classes from [docs/bug-classes.md](../../docs/bug-classes.md): [`bugs-check.test.ts`](bugs-check.test.ts) (a bad line per guard in [scripts/bugs-check.ts](../../scripts/bugs-check.ts) must fail).
- Search and answer scorers:
  - [`date-recency-scorers.test.ts`](date-recency-scorers.test.ts): `asOf` is the pinned run date; the top hit is recent.
  - [`answer-accuracy.eval.test.ts`](answer-accuracy.eval.test.ts): scores the offline dev set for faithfulness, sure-but-wrong, and no-answer rates.
  - [`search-determinism.test.ts`](search-determinism.test.ts): with `WEBULAR_DETERMINISTIC=1`, the same sources give the same hits.

## Rules

- Add a gate, named after its rule, when code can decide the rule.
- Share analyzers through [tests/_support/](../_support/), not between gate files.
- A gate lists every fault at once.
- Fix the code a gate flags; never loosen the gate.

## Checks

`mise run test:file tests/quality`

Install, packaging, limit, and gate-budget bugs: `mise run bugs:tests-build`.
