# scripts/bench/AGENTS.md

The benchmarks. The root [AGENTS.md](../../AGENTS.md) holds the repo-wide rules. These rules keep scores fair and hard to game.

## What lives here

- [peers/](peers/): the peer benchmark against other web research tools.
- [tasks/](tasks/): the generators that build the task sets in [bench/tasks/](../../bench/tasks/).
- [run.ts](run.ts), [worker-io.ts](worker-io.ts), [loader.ts](loader.ts), [schema.ts](schema.ts), [guards.ts](guards.ts), [recordings.ts](recordings.ts), and [order.ts](order.ts): the live runner and replay path, with the guards every row set must pass.
- [grade.ts](grade.ts), [judge.ts](judge.ts), [stats.ts](stats.ts), [cost.ts](cost.ts), [claims.ts](claims.ts), and [report.ts](report.ts): grading, statistics, cost, and the report.
- [agreement.ts](agreement.ts): Cohen's and Fleiss' kappa, as pure functions, shared by the judge and the grader track.
- [dataset-fetch.ts](dataset-fetch.ts), [dataset-manifest.ts](dataset-manifest.ts), and [dataset-pin.ts](dataset-pin.ts): download and check the public datasets pinned in [bench/datasets/](../../bench/datasets/).
- [bare-bun.ts](bare-bun.ts), [import-feed-workflow.ts](import-feed-workflow.ts), and [import-mastra-workflows.ts](import-mastra-workflows.ts): the cold-start probes that `mise run bench` times.

## Rules

### Task sets

- Tasks come from outside sources, and they are drawn before any webular run.
- A public dev set is for tuning. A sealed test set is only for scoring.
- Never tune webular on the test set. Webular code and prompts never read private task files. No list of test-set misses is written where tuning can read it.
- Never add, drop, or rewrite a task because of a webular miss. A pilot that drops tasks runs on the dev set only.
- Each task stores its author, build date, source URL, as-of date, accepted aliases, and question type.

### Runs and caches

- Each round gets a round id and its own cache folder, `rounds/<round-id>/cache`. `WEBULAR_CACHE_DIR` points there.
- That folder must not exist before the round. No tool reads another round's folder. The folder is deleted once the round's recordings are saved.
- Headline latency comes from cold runs with `WEBULAR_NO_CACHE=1`. Report cold and warm runs apart.
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
