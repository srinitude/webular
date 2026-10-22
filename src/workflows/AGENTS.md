# src/workflows/AGENTS.md

Rules for the Mastra workflows, under [src/AGENTS.md](../AGENTS.md).

## What lives here

One workflow per command, such as `search.ts`, `scrape.ts`, `crawl.ts`, and `answer.ts`. A command in `src/commands/` runs the workflow with the same name.

- `runtime.ts` is the one place where an Effect program meets a Mastra step. Its runtime also holds the per-origin robots.txt cache.
- `scrape-fallback.ts` holds the render and PDF fallbacks around the plain fetch.

## Rules

- A workflow has no model call of its own. Jev decisions go through `decisionStep` from `src/lib/jev/steps.ts`, with a rule-based fallback.
- Every step runs its Effect program through `runtime.ts`. Mastra needs a Promise here, so this is the only Promise edge. Do not add another.
- Keep the real work in `src/lib/`. A step stays short and calls into it.
- Fan out with a bounded `Effect.forEach` and a size from `src/core/budget.ts`. Results keep input order.
- Give a sub-run a stable run id, such as the target URL.
- Discovery commands keep partial failures in the payload. Exit 1 only when the payload is empty and errors exist.

### robots.txt

- Check robots.txt through `robotsGate` in `src/lib/robots-gate.ts` before any one-off page fetch.
- A disallowed page is never fetched, and no browser or archive fallback runs for it.
- Scrape returns `status: "blocked"` with `reason: "robots"`, the matched `rule`, and `userAgent: "webular"`.
- Only scrape's `ignoreRobots` fetches a disallowed page, and only for the one URL the user named. Its output carries `robots: "disallowed"`.
- Batch and map have no override.

### Mastra

- Make each step with `createStep()` and each workflow with `createWorkflow()`, both with an `inputSchema` and an `outputSchema`. Chain with `.then()` and end with `.commit()` before any run. Source: [mastra-ai/mastra@@mastra/core@1.78.0](https://github.com/mastra-ai/mastra/blob/@mastra/core@1.78.0/docs/src/content/en/docs/workflows/overview.mdx).
- The first step's input schema matches the workflow's, the last step's output schema matches the workflow's, and each step's output matches the next step's input. Share one schema const per pair. Source: [mastra-ai/mastra@@mastra/core@1.78.0](https://github.com/mastra-ai/mastra/blob/@mastra/core@1.78.0/docs/src/content/en/docs/workflows/control-flow.mdx).
- Check a run's `status` before you read `result` or `error`. Source: [mastra-ai/mastra@@mastra/core@1.78.0](https://github.com/mastra-ai/mastra/blob/@mastra/core@1.78.0/docs/src/content/en/docs/workflows/overview.mdx).
- Pass `shouldPersistSnapshot: () => false` to every `createWorkflow`. Webular has no Mastra storage, and the default still builds a snapshot at each step. Source: [mastra-ai/mastra@@mastra/core@1.78.0](https://github.com/mastra-ai/mastra/blob/@mastra/core@1.78.0/packages/core/src/workflows/workflow.ts).
- Forward each step's `abortSignal` into the Effect run, so a cancelled run stops fetching. Keep step outputs small (zod schemas, summaries only) and step chains linear.
- Reuse one `ManagedRuntime` per process and dispose it at teardown. Do not build a second runtime with its own fetch layer.
- Remove duplicate URLs before a batch fans out.

## Checks

- `scrape.ts:18`, `monitor.ts:15`, `extract.ts:17`, `act.ts:17`, `summarize.ts:18`, `feed.ts:12`, and `map.ts:18` use bare `z.url()`, with no shared http-only URL helper.

```bash
mise run test:file tests/commands tests/machines/command-lifecycle.test.ts
```
