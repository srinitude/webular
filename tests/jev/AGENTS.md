# tests/jev/AGENTS.md

This folder holds the tests for the Jev framework in [`src/lib/jev/`](../../src/lib/jev/), and it follows [tests/AGENTS.md](../AGENTS.md).

- `mise run jev:check` runs every test here.
- A test whose name ends in eval.test.ts runs a decision against its cases.
- [`evals-sync.test.ts`](evals-sync.test.ts) checks that every file in [evals/](evals/) belongs to exactly one decision.
- [`answer-figure.eval.test.ts`](answer-figure.eval.test.ts) and [`research-figures.eval.test.ts`](research-figures.eval.test.ts) compare the image arm with the text-only arm, offline.
- [`key-platform.test.ts`](key-platform.test.ts) checks that `TYPESAFE_API_KEY` works on every system and that the Keychain lookup runs only on macOS.
- [`tests/jev/evals/`](evals/) holds the cases, and [`tests/jev/replay/`](replay/) holds the recorded Jev answers.
- [`tests/jev/candidates/`](candidates/) keeps eval cases for decisions that have no code. The segmenter cases stay as data for `research.sentences`, which has no decision, and the `answer` image arm cases sit there because no decision owns them. The eval check does not scan this folder.
- [`tests/jev/learn/`](learn/) holds the tests for the learning loop.
- [`tests/jev/docs-guard-support.ts`](docs-guard-support.ts) and [`tests/jev/work-count.ts`](work-count.ts) are helpers. They are not tests.
- The framework tests: [`define.test.ts`](define.test.ts), [`definition-lint.test.ts`](definition-lint.test.ts), [`framework.test.ts`](framework.test.ts), [`framework-bounds.test.ts`](framework-bounds.test.ts), [`guards.test.ts`](guards.test.ts), [`no-direct-calls.test.ts`](no-direct-calls.test.ts), [`code-check.test.ts`](code-check.test.ts), [`decision-cost.test.ts`](decision-cost.test.ts), and [`route.test.ts`](route.test.ts).
- The model tests: "latest-check.test.ts", "latest-model.test.ts", and [`machine-replay.test.ts`](machine-replay.test.ts).
- The fetch tests: [`fetch.test.ts`](fetch.test.ts) and [`fetch-path.test.ts`](fetch-path.test.ts).
- The docs guard tests: [`docs-cache.test.ts`](docs-cache.test.ts), [`docs-gate-hook.test.ts`](docs-gate-hook.test.ts), [`docs-gate-situation.test.ts`](docs-gate-situation.test.ts), [`docs-guard.test.ts`](docs-guard.test.ts), and [`docs-guard-refresh.test.ts`](docs-guard-refresh.test.ts).
- The answer and summary tests: [`answer-lead.test.ts`](answer-lead.test.ts), [`answer-shortlist.test.ts`](answer-shortlist.test.ts), [`crop-box.test.ts`](crop-box.test.ts), [`summarize-pool.test.ts`](summarize-pool.test.ts), and [`summary-follow-up.test.ts`](summary-follow-up.test.ts).
- The other eval tests: [`cli-suggest.eval.test.ts`](cli-suggest.eval.test.ts), [`decisions.eval.test.ts`](decisions.eval.test.ts), [`image-kind.eval.test.ts`](image-kind.eval.test.ts), [`image-router.eval.test.ts`](image-router.eval.test.ts), [`page-title.eval.test.ts`](page-title.eval.test.ts), [`search-intent.eval.test.ts`](search-intent.eval.test.ts), and [`summarize.eval.test.ts`](summarize.eval.test.ts).
- The request tests: [`eval-labels.test.ts`](eval-labels.test.ts), [`jev-request-log.effect.test.ts`](jev-request-log.effect.test.ts) (the request log), [`pin-fallback.test.ts`](pin-fallback.test.ts), [`request-shape.test.ts`](request-shape.test.ts), [`retry-errors.test.ts`](retry-errors.test.ts).
- The security tests: [`crop-box.security.test.ts`](crop-box.security.test.ts) (crop limits) and [`docs-fetch-cap.security.test.ts`](docs-fetch-cap.security.test.ts) (the docs fetch size cap).
- [`fixtures/`](fixtures/) holds the fixed inputs these tests read.
