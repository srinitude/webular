# tests/jev/AGENTS.md

Tests for the Jev framework in [src/lib/jev/](../../src/lib/jev/). The parent rules are in [tests/AGENTS.md](../AGENTS.md).

- `mise run jev:check` runs every test here.
- A test whose name ends in eval.test.ts runs a decision against its cases.
- [evals-sync.test.ts](evals-sync.test.ts) checks that every file in [evals/](evals/) belongs to exactly one decision.
- [neutral-wording.test.ts](neutral-wording.test.ts) checks that no instruction, option, or level uses a pushy word such as "please" or "important".
- [answer-figure.eval.test.ts](answer-figure.eval.test.ts), [research-figures.eval.test.ts](research-figures.eval.test.ts), and [summarize-figure.eval.test.ts](summarize-figure.eval.test.ts) compare the image arm with the text-only arm, offline.
- [act-goal-image.eval.test.ts](act-goal-image.eval.test.ts) checks that `act --goal` can click a target the element tree does not name. Jev draws a Box on the window screenshot. It runs offline, and live with `WEBULAR_TEST_LIVE=1`.
- [key-platform.test.ts](key-platform.test.ts) checks that `TYPESAFE_API_KEY` works on every system and the Keychain lookup runs only on macOS.
- [evals/](evals/) holds the cases, and [replay/](replay/) holds the recorded Jev answers.
- [candidates/](candidates/) keeps eval cases for decisions that have no code. The segmenter cases stay as data for `research.sentences`, which has no decision. The `answer` and `summarize` image arm cases sit there because no decision owns them. The eval check does not scan this folder.
- [learn/](learn/) holds the tests for the learning loop.
- [docs-guard-support.ts](docs-guard-support.ts) and [work-count.ts](work-count.ts) are helpers, not tests.
- The framework tests: [define.test.ts](define.test.ts), [definition-lint.test.ts](definition-lint.test.ts), [framework.test.ts](framework.test.ts), [framework-bounds.test.ts](framework-bounds.test.ts), [guards.test.ts](guards.test.ts), [no-direct-calls.test.ts](no-direct-calls.test.ts), [code-check.test.ts](code-check.test.ts), [decision-cost.test.ts](decision-cost.test.ts), and [route.test.ts](route.test.ts).
- The model tests: "latest-check.test.ts", "latest-model.test.ts", and [machine-replay.test.ts](machine-replay.test.ts).
- The fetch tests: [fetch.test.ts](fetch.test.ts) and [fetch-path.test.ts](fetch-path.test.ts).
- The docs guard tests: [docs-cache.test.ts](docs-cache.test.ts), [docs-gate-hook.test.ts](docs-gate-hook.test.ts), [docs-gate-situation.test.ts](docs-gate-situation.test.ts), [docs-guard.test.ts](docs-guard.test.ts), and [docs-guard-refresh.test.ts](docs-guard-refresh.test.ts).
- The answer, research, and summary tests: [answer-lead.test.ts](answer-lead.test.ts), [answer-shortlist.test.ts](answer-shortlist.test.ts), [crop-box.test.ts](crop-box.test.ts), `research-hop.test.ts`, [summarize-pool.test.ts](summarize-pool.test.ts), and [summary-follow-up.test.ts](summary-follow-up.test.ts).
- The other eval tests: [cli-suggest.eval.test.ts](cli-suggest.eval.test.ts), [decisions.eval.test.ts](decisions.eval.test.ts), [image-kind.eval.test.ts](image-kind.eval.test.ts), [image-router.eval.test.ts](image-router.eval.test.ts), [page-title.eval.test.ts](page-title.eval.test.ts), [search-intent.eval.test.ts](search-intent.eval.test.ts), and [summarize.eval.test.ts](summarize.eval.test.ts).
- The request tests: [eval-labels.test.ts](eval-labels.test.ts), [jev-request-log.effect.test.ts](jev-request-log.effect.test.ts) (the request log), [pin-fallback.test.ts](pin-fallback.test.ts), [request-shape.test.ts](request-shape.test.ts), [agreed-none.test.ts](agreed-none.test.ts) (an agreed none pick reaches its readers), [both-orders-bytes.test.ts](both-orders-bytes.test.ts), [retry-errors.test.ts](retry-errors.test.ts), and [call-budget.test.ts](call-budget.test.ts) (the cap on live calls).
- The security tests: [crop-box.security.test.ts](crop-box.security.test.ts) (crop limits) and [docs-fetch-cap.security.test.ts](docs-fetch-cap.security.test.ts) (the docs fetch size cap).
- [fixtures/](fixtures/) holds the fixed inputs these tests read.
