# src/lib/jev/decisions/AGENTS.md

Rules for the individual Jev decisions, under [src/lib/jev/AGENTS.md](../AGENTS.md).

## What lives here

One file per decision job. They group by command:

- Search and answer: `search.ts`, `search-intent.ts`, `answer.ts`, `answer-evidence.ts`, `answer-citation.ts`, and `answer-sentences.ts`.
- Research and summary: `research.ts`, `research-sentences.ts`, `summarize.ts`, and `summary-follow-up.ts`.
- Pages: `scrape.ts`, `page-title.ts`, `extract.ts`, `monitor.ts`, `map.ts`, and `crawl.ts`.
- Control: `act.ts` picks the element to click. `cli-suggest.ts` guesses which command a user meant.

## Rules

- Each file builds its decision with `defineDecision`, and `decisions.ts` in the parent folder registers it.
- A payload lists the purpose first, then the decisive facts, then the context. Questions point at state fields by backticked path.
- Each decision has a rule-based fallback. Write it first. The fallback is what runs below the bar, with no key, and on any error.
- Use a Choice when exactly one option is right, and ask it in both option orders. Use one yes/no per candidate when several can be true together.
- Code keeps a veto. For example, `act.ts` drops a destructive click even when Jev picks it.
- Each decision has a labeled eval file in `tests/jev/evals/`. Add the cases with the decision.
- When a result is wrong, fix the input payload, not the bar.

## Checks

- `src/lib/jev/decisions/research.ts:122` calls `runPromise` outside the allowed process edges.

```bash
mise run jev:check
```
