# src/lib/jev/AGENTS.md

Rules for the Jev client and decision framework, under [src/lib/AGENTS.md](../AGENTS.md).

## What lives here

- Client: [`client.ts`](client.ts) owns the endpoint and `ask`. [`model.ts`](model.ts) holds the one model name every call sends. [`post.ts`](post.ts) makes one HTTP call with a jittered retry. [`run.ts`](run.ts) runs a decision on the shared runtime. [`errors.ts`](errors.ts) maps HTTP failures to next actions.
- Route: [`route.ts`](route.ts) picks the Jev route in order: off, then the direct key, then the Pydantic AI Gateway. [`doctor-route.ts`](doctor-route.ts) is the `webular doctor` row that shows the active route and checks its key.
- Framework: [`define.ts`](define.ts) holds `defineDecision`. [`decisions.ts`](decisions.ts) is the registry. [`steps.ts`](steps.ts) is the door from a workflow (`decisionStep`). [`machine.ts`](machine.ts) is the door from an XState machine (`machineDecision`).
- Docs guard: [`docs-guard.ts`](docs-guard.ts), [`docs-snapshot.ts`](docs-snapshot.ts), [`docs-fetch.ts`](docs-fetch.ts), [`docs-cache.ts`](docs-cache.ts), and [`docs-violations.ts`](docs-violations.ts) check each batch against a verified snapshot of the model's docs. [`docs-snapshot.json`](docs-snapshot.json) is that snapshot.
- State: [`store.ts`](store.ts) holds the LRU, the replay files, the calibration log, and the drift file. [`budget.ts`](budget.ts) caps a decision at half the caller's fetch timeout.
- Fetch decisions: [`fetch.ts`](fetch.ts), [`fetch-page.ts`](fetch-page.ts), and [`fetch-browser.ts`](fetch-browser.ts). [`picks.ts`](picks.ts) has the extract and feed picks. [`answers.ts`](answers.ts) is the door for code outside this folder that builds its own questions.
- Subfolders: [`decisions/`](decisions/) has one file per job. [`payload/`](payload/) builds the request bytes. [`learn/`](learn/) records calls and tests lessons.

## Rules

- Every decision goes through `defineDecision`. It needs a docs-checked payload, a labeled eval file, the 0.95 bar, a rule-based fallback, and a code check after the pick.
- Jev decides and code acts. A missing key, a timeout, or an API error returns the fallback and never blocks a workflow.
- A decision acts only when both option orders agree at the bar and the code check passes.
- Every Jev call sends one model: `JEV_LATEST_RELEASED` in [`model.ts`](model.ts), the highest released id. A failed call retries on that same model and never switches models. For tests, `WEBULAR_JEV_MODEL` may name another released id; an alias or preview name there is ignored. A guard test in [`tests/jev/`](../../../tests/jev/) fails if any other Jev model id shows up in [`src/`](../../) or [`plugins/`](../../../plugins/).
- `mise run jev:latest-check` fails when docs.typesafe.ai lists a Jev release above `JEV_LATEST_RELEASED`. It is off by default: `default`, `test`, and CI never run it. Run it by hand, then review the docs and raise the pin.
- Never edit [`docs-snapshot.json`](docs-snapshot.json) by hand. `mise run jev:docs` writes it.
- Before you edit a file here, refresh the docs with `mise run jev:docs`.

## Checks

- `src/lib/jev/machine.ts:31` reads XState's private `_nodes`. Only [`src/machines/agent.ts`](../../machines/agent.ts) may do that.
- `src/lib/jev/steps.ts:33` and `src/lib/jev/run.ts:12` call `runPromise` outside the allowed process edges.

```bash
mise run jev:check
mise run jev:latest-check
```

## Children

- [decisions/AGENTS.md](decisions/AGENTS.md)
- [learn/AGENTS.md](learn/AGENTS.md)
- [payload/AGENTS.md](payload/AGENTS.md)
