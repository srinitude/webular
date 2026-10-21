# tests/jev/learn/AGENTS.md

This folder holds the tests for the Jev learning loop, and it follows [tests/jev/AGENTS.md](../AGENTS.md).

- It holds tests only. No data files live here.
- `tests/jev/learn/learn.test.ts` covers the call recorder, the lessons, and the corrections that become eval cases.
- `tests/jev/learn/lint.test.ts` covers the payload lint.
- The code under test is in `src/lib/jev/learn/`.
