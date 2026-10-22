# src/workflows/AGENTS.md

Rules for the Mastra workflows, under [src/AGENTS.md](../AGENTS.md).

## What lives here

One workflow per command in [`src/commands/`](../commands/): [act.ts](act.ts), [answer.ts](answer.ts), [audit.ts](audit.ts), [batch.ts](batch.ts), [crawl.ts](crawl.ts), [diagram.ts](diagram.ts), [doctor.ts](doctor.ts), [extract.ts](extract.ts), [feed.ts](feed.ts), [map.ts](map.ts), [media.ts](media.ts), [monitor.ts](monitor.ts), [parse.ts](parse.ts), [research.ts](research.ts), [scrape.ts](scrape.ts), [search.ts](search.ts), [summarize.ts](summarize.ts), [tasks.ts](tasks.ts). Helpers: [runtime.ts](runtime.ts), [scrape-fallback.ts](scrape-fallback.ts), [scrape-schemas.ts](scrape-schemas.ts), [map-xml.ts](map-xml.ts).

## Rules

- Don't keep a redirect source or a soft-404 end page in map output. Key each link on its final URL. Source: [arXiv 2507.22019](https://arxiv.org/abs/2507.22019).
- A workflow has no model call of its own. Jev decisions go through `decisionStep` from [`src/lib/jev/steps.ts`](../lib/jev/steps.ts), with a rule-based fallback.
- Every step runs its Effect program through [runtime](runtime.ts). Mastra needs a Promise here; this is the only Promise edge, so add no other.
- Keep the real work in [`src/lib/`](../lib/). A step stays short and calls into it.
- Fan out with a bounded `Effect.forEach` and a size from [`src/core/budget.ts`](../core/budget.ts). Results keep input order.
- Give a sub-run a stable run id, such as the target URL.
- Discovery commands keep partial failures in the payload. Exit 1 only when the payload is empty and errors exist.

### robots.txt

- Check robots.txt through `robotsGate` in [`src/lib/robots-gate.ts`](../lib/robots-gate.ts) before any one-off page fetch.
- A disallowed page is never fetched, and no browser or archive fallback runs.
- Scrape returns `status: "blocked"` with `reason: "robots"`, the matched `rule`, and `userAgent: "webular"`.
- Only scrape's `ignoreRobots` fetches a disallowed page, and only for the one URL the user named. Its output carries `robots: "disallowed"`.
- Batch, map, and crawl have no override.

### Mastra

- Make each step with `createStep()` and each workflow with `createWorkflow()`, both with an `inputSchema` and an `outputSchema`. Chain with `.then()` and end with `.commit()` before any run. Source: [mastra-ai/mastra@@mastra/core@1.78.0](https://github.com/mastra-ai/mastra/blob/@mastra/core@1.78.0/docs/src/content/en/docs/workflows/overview.mdx).
- The first step's input schema matches the workflow's, the last step's output schema matches the workflow's, and each step's output matches the next step's input. Share one schema const per pair. Source: [mastra-ai/mastra@@mastra/core@1.78.0](https://github.com/mastra-ai/mastra/blob/@mastra/core@1.78.0/docs/src/content/en/docs/workflows/control-flow.mdx).
- Check a run's `status` before you read `result` or `error`. Source: [mastra-ai/mastra@@mastra/core@1.78.0](https://github.com/mastra-ai/mastra/blob/@mastra/core@1.78.0/docs/src/content/en/docs/workflows/overview.mdx).
- Pass `shouldPersistSnapshot: () => false` to every `createWorkflow`. Webular has no Mastra storage, and the default still builds a snapshot at each step. Source: [mastra-ai/mastra@@mastra/core@1.78.0](https://github.com/mastra-ai/mastra/blob/@mastra/core@1.78.0/packages/core/src/workflows/workflow.ts).
- Cancellation (`mise run bugs:effect`): forward each step's `abortSignal` into its Effect run, so a cancelled run stops. Keep step outputs small and step chains linear.
- Reuse one `ManagedRuntime` per process and dispose it at teardown. Do not build a second runtime with its own fetch layer.
- Drop duplicate URLs before batch fan-out.

## Checks

- [scrape](scrape.ts), [monitor](monitor.ts), [extract](extract.ts), [act](act.ts), [summarize](summarize.ts), [feed](feed.ts), [map](map.ts), [crawl](crawl.ts), and [media](media.ts) use bare `z.url()`, which also takes `file:`.
- `mise run bugs:security`: http-only batch URLs (SSRF).

```bash
mise run test:file tests/commands tests/machines/command-lifecycle.test.ts
```
