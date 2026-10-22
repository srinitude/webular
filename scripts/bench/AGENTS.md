# scripts/bench/AGENTS.md

The benchmark code. The root [AGENTS.md](../../AGENTS.md) holds the repo-wide rules. They keep scores fair and hard to game.

## What lives here

- [peers/](peers/) and [tasks/](tasks/) (task set generators).
- Run and replay: [run.ts](run.ts), [worker-io.ts](worker-io.ts), [loader.ts](loader.ts), [schema.ts](schema.ts), [guards.ts](guards.ts), [recordings.ts](recordings.ts), [order.ts](order.ts).
- Grading and report: [grade.ts](grade.ts), [judge.ts](judge.ts), [stats.ts](stats.ts), [cost.ts](cost.ts), [claims.ts](claims.ts), [report.ts](report.ts), [agreement.ts](agreement.ts).
- [search-gold.ts](search-gold.ts) runs `webular search` on [the dev set](../../bench/tasks/dev/search.jsonl) and prints hit@10 and median latency.
- Scoreboard: [scoreboard.ts](scoreboard.ts) and [scoreboard-rows.ts](scoreboard-rows.ts). `mise run bench:scoreboard` writes [bench/scoreboard.json](../../bench/scoreboard.json) and the table in [docs/scoreboard.md](../../docs/scoreboard.md). A metric with no eval is a "gap" row.
- [rescore.ts](rescore.ts) rescores agent-run chunks under [tests/models/check.ts](../../tests/models/check.ts) and merges them into one run file for `mise run bench:docs`.
- Datasets: [fetch](dataset-fetch.ts), [manifest](dataset-manifest.ts), [pin](dataset-pin.ts). Cold-start probes: [bare-bun.ts](bare-bun.ts), [import-feed-workflow.ts](import-feed-workflow.ts), [import-mastra-workflows.ts](import-mastra-workflows.ts).

## Rules

- Don't grade a number by exact text match. Give each numeric answer a stated tolerance. Source: [arXiv 2509.07968](https://arxiv.org/abs/2509.07968).
- Don't report a judge score without its calibration against human labels and a confidence interval. Source: [arXiv 2511.21140](https://arxiv.org/abs/2511.21140).

### Task sets

- Tasks come from outside sources, and they are drawn before any webular run.
- A public dev set is for tuning. A sealed test set is only for scoring.
- Never tune webular on the test set. Webular code and prompts never read private task files. No list of test-set misses is written where tuning can read it.
- Never add, drop, or rewrite a task because of a webular miss. A pilot that drops tasks runs on the dev set only.
- Each task stores its author, build date, source URL, as-of date, accepted aliases, and question type.

### Runs and caches

- Each round gets its own cache folder, `rounds/<round-id>/cache`, set in `WEBULAR_CACHE_DIR`. It must not exist before the round. No tool reads another round's folder. It is deleted once the round's recordings are saved.
- Headline latency is from cold runs with `WEBULAR_NO_CACHE=1`. Report cold and warm runs apart.
- A run fails if any `localhost` or `127.0.0.1` URL appears in a tool's output.
- Each peer runs through its official API at its documented defaults.
- Count the cost of every call, Jev calls included. A tie inside the noise bar stays a tie.
- Keep a speed or accuracy change only when it beats the noise bar, max(2 x bootstrap SE, 10 ms), and accuracy holds.
- Bench one change at a time on fixed input. `mise run bench` times cold starts with [hyperfine](https://github.com/sharkdp/hyperfine), then runs the scaling run in [complexity.ts](../../tests/bench/complexity.ts).
- Entry scripts end in `BunRuntime.runMain`, not `Effect.runPromise` or `Effect.runFork`.

### Fetched datasets

- A public dataset is downloaded at run time, never copied into git. Its manifest pins the revision and a sha256, and the fetch fails on a mismatch.
- No CI step downloads a dataset. Tests use a local fixture.

### Recordings and keys

- Recordings in [`bench/recordings/`](../../bench/recordings/) are keyed by sha256 and replayed. Never edit one by hand.
- Peer keys come from the environment or the OS keychain ([keys.ts](peers/keys.ts)). Never write a key to a recording or result.
- Run `mise run bench:peers:live` only when asked. It spends paid API quota.

## Checks

```bash
mise run bench:peers
mise run test:file tests/bench
```

## Children

- [peers/AGENTS.md](peers/AGENTS.md)
- [tasks/AGENTS.md](tasks/AGENTS.md)
