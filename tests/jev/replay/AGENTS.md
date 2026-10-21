# tests/jev/replay/AGENTS.md

This folder holds recorded Jev answers, and it follows [tests/jev/AGENTS.md](../AGENTS.md).

- Each file holds one answer. Its name is the cache key of the request, in hex.
- `tests/jev/decisions.eval.test.ts` points `WEBULAR_JEV_REPLAY` at this folder in CI. A hit never calls the API.
- A miss fails the test. To add an answer, run the eval with a Jev key and `WEBULAR_JEV_RECORD=1`.
- The store code is `replayStore` in `src/lib/jev/store.ts`.
- A recorded answer is not written by hand, and a changed request gets a different file name.
