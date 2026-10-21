# tests/AGENTS.md

The Bun test suite. The root [AGENTS.md](../AGENTS.md) holds the commands and the code gates.

## What lives here

- `tests/quality/`: the code gates. Add a gate there when code can check a rule.
- `tests/machines/`: model-based tests that walk every path of each XState machine.
- `tests/jev/`: Jev evals and replays.
- `tests/e2e/`: the user-side surface run behind `mise run e2e`.
- `tests/models/`: the agent scenarios behind `mise run test:models`.
- `tests/_support/`: shared helpers. Look there before you write one.

## Rules

- Run each test body as an Effect through `eff` in `tests/_support/run.ts`.
- Serve pages from the local fixture in `tests/_support/fixture.ts` (`Bun.serve` on `127.0.0.1`, port 0). Never call the live internet in a default run.
- Gate a live case behind `WEBULAR_TEST_LIVE=1`.
- Get temp folders from `tmpDir` in `tests/_support/run.ts`. They clean up when the test ends.
- `bun test --parallel` runs files in worker processes and implies `--isolate`. `[test] preload` in `bunfig.toml` runs setup scripts for `bun test`.
- Under `bun test --parallel`, key any per-worker file, database path, or port on `BUN_TEST_WORKER_ID`, never on a fixed path.
- Never wait with `setTimeout` or a sleep. Poll with a deadline, or await the event.
- Use `TestClock` from Effect's testing module for retry, TTL, and deadline tests, never real sleeps.
- Test the memory budget with injected cgroup limits, not the host's real ones. Source: https://docs.kernel.org/admin-guide/cgroup-v2.html.
- Name each test after the outcome a user sees, not the function it calls.
- Write the eval or test first, then the code.
- `mise run test:models` runs on the logged-in subscription, one run at a time. It never runs in CI.

## Checks

```bash
mise run test:file tests/quality
mise run test
```
