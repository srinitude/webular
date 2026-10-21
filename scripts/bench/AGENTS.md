# scripts/bench/AGENTS.md

The benchmarks. The root [AGENTS.md](../../AGENTS.md) holds the repo-wide rules. These rules keep scores fair and hard to game.

## What lives here

- `scripts/bench/peers/`: the peer benchmark against other web research tools.
- The other scripts here are cold-start and scaling probes that `mise run bench` times.

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
- Bench one change at a time on fixed input. Add fetch-and-cache, crawl-frontier, and peak-RSS benches next to the cold-start runs. Source: hyperfine README.
- Entry scripts end in `BunRuntime.runMain`, not `Effect.runPromise` or `Effect.runFork`.

### Recordings and keys

- Recordings in `bench/recordings/` are keyed by sha256 and replayed. Never edit one by hand.
- Peer keys come from the environment or the OS keychain (`scripts/bench/peers/keys.ts`). Never write a key to a recording or result.
- Run `mise run bench:peers:live` only when asked. It spends paid API quota.

## Checks

```bash
mise run bench:peers
mise run test:file tests/bench
```

## Children

- [peers/AGENTS.md](peers/AGENTS.md)
