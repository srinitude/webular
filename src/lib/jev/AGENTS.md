# src/lib/jev/AGENTS.md

Rules for the Jev client and decision framework, under [src/lib/AGENTS.md](../AGENTS.md).

## What lives here

- Client: `client.ts` owns the endpoint and `ask`. `post.ts` makes one HTTP call with a jittered retry. `run.ts` runs a decision on the shared runtime. `errors.ts` maps HTTP failures to next actions.
- Framework: `define.ts` holds `defineDecision`. `decisions.ts` is the registry. `steps.ts` is the door from a workflow (`decisionStep`). `machine.ts` is the door from an XState machine (`machineDecision`).
- Docs guard: `docs-guard.ts`, `docs-snapshot.ts`, `docs-fetch.ts`, `docs-cache.ts`, and `docs-violations.ts` check each batch against a verified snapshot of the model's docs. `docs-snapshot.json` is that snapshot.
- State: `store.ts` holds the LRU, the replay files, the calibration log, and the drift file. `budget.ts` caps a decision at half the caller's fetch timeout.
- Fetch decisions: `fetch.ts`, `fetch-page.ts`, and `fetch-browser.ts`. `picks.ts` has the extract and feed picks. `answers.ts` is the door for code outside this folder that builds its own questions.
- Subfolders: `decisions/` has one file per job. `payload/` builds the request bytes. `learn/` records calls and tests lessons.

## Rules

- Every decision goes through `defineDecision`. It needs a docs-checked payload, a labeled eval file, the 0.95 bar, a rule-based fallback, and a code check after the pick.
- Jev decides and code acts. A missing key, a timeout, or an API error returns the fallback and never blocks a workflow.
- A decision acts only when both option orders agree at the bar and the code check passes.
- Never edit `docs-snapshot.json` by hand. `mise run jev:docs` writes it.
- Before you edit a file here, refresh the docs with `mise run jev:docs`.

## Checks

- `src/lib/jev/machine.ts:31` reads XState's private `_nodes`. Only `src/machines/agent.ts` may do that.
- `src/lib/jev/steps.ts:33` and `src/lib/jev/run.ts:12` call `runPromise` outside the allowed process edges.

```bash
mise run jev:check
```

## Children

- [decisions/AGENTS.md](decisions/AGENTS.md)
- [learn/AGENTS.md](learn/AGENTS.md)
- [payload/AGENTS.md](payload/AGENTS.md)
