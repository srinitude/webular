# tests/models/grader/AGENTS.md

The grader track: how well each Claude judge agrees with gold labels. The parent rules are in [tests/models/AGENTS.md](../AGENTS.md).

## What lives here

- [judge.ts](judge.ts): one rubric judgment by one Claude model through headless claude -p, with no tools and no web, on a blinded answer.
- [blind.ts](blind.ts): bias controls before any judge sees an answer. It strips provider and tool names, cuts length to a cap, and keeps a pairwise verdict only when it holds in both orders.
- [kappa.ts](kappa.ts): Cohen's and Fleiss' kappa, as pure functions.
- [cross-check.ts](cross-check.ts): judges every rubric on the gold set with all three Claude models, one job at a time, and prints the agreement stats.
- [grader.test.ts](grader.test.ts): offline checks of kappa, blinding, order swaps, verdict parsing, judge flags, and the cross-check.
- [fixtures/](fixtures/): the gold labels and recorded judgments.

## Rules

- Blind every answer before a judge sees it.
- A Claude grader never sets the headline score.
- Run cross-check.ts only when asked. It spends subscription quota.

## Checks

`mise run test:file tests/models/grader`

## Children

- [fixtures/AGENTS.md](fixtures/AGENTS.md): the gold set and recorded judgments.
