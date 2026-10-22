# tests/jev/AGENTS.md

Tests for the Jev framework in [`src/lib/jev/`](../../src/lib/jev/). The parent rules are in [tests/AGENTS.md](../AGENTS.md).

- `mise run jev:check` runs every test here.
- A test whose name ends in eval.test.ts runs one decision against its cases.
- [`evals-sync.test.ts`](evals-sync.test.ts) checks that every file in [evals/](evals/) belongs to exactly one decision.
- [`answer-figure.eval.test.ts`](answer-figure.eval.test.ts) and [`research-figures.eval.test.ts`](research-figures.eval.test.ts) compare the image arm with the text-only arm, offline.
- [`key-platform.test.ts`](key-platform.test.ts) checks that `TYPESAFE_API_KEY` works on every system and that the Keychain lookup runs only on macOS.
- [`tests/jev/evals/`](evals/) holds the cases, and [`tests/jev/replay/`](replay/) holds the recorded Jev answers.
- [`tests/jev/candidates/`](candidates/) keeps eval cases for a decision that no code makes yet. The segmenter cases stay as data for a later try at `research.sentences`, and the `answer` image arm cases sit there because no decision of their own owns them. The eval check does not scan this folder.
- [`tests/jev/learn/`](learn/) holds the tests for the learning loop.
- [`tests/jev/docs-guard-support.ts`](docs-guard-support.ts) and [`tests/jev/work-count.ts`](work-count.ts) are helpers. They are not tests.
