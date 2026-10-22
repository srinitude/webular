# bench/spec/AGENTS.md

The benchmark spec. The parent rules are in [bench/AGENTS.md](../AGENTS.md). The integrity rules for the bench code are in [scripts/bench/AGENTS.md](../../scripts/bench/AGENTS.md).

## What lives here

- [benchmark-spec.md](benchmark-spec.md): the main spec. It says how to build and run a fair benchmark of webular against tools that do the same jobs.
- [spec-grading-and-stats.md](spec-grading-and-stats.md): graders, statistics, latency, and cost.
- [spec-integrity-and-report.md](spec-integrity-and-report.md): fairness, anti-cheating, guard tests, and the report.
- [spec-audit-fixes.md](spec-audit-fixes.md): maps each bias-audit finding to the spec rule that fixes it.
- [sources.md](sources.md): every source the spec cites, with its URL and date.

## Rules

- The keep rule: keep a change only when it beats the noise bar and accuracy holds. The integrity rules give the bar's formula.
- Never commit results or recordings from your own runs. Commit them only when the lead asks.
- The private task split is gitignored. Tests that need it skip when it is missing.
- Pin every peer. Its API, plan, and price stay fixed for a whole round.
- Arms run in a seeded random order for each model and task. Each result row keeps the seed.
- Change a rule here before you change the code that follows it.

## Checks

`mise run test:file tests/bench/guards-set.test.ts tests/bench/guards-grade.test.ts`

## Children

None.
