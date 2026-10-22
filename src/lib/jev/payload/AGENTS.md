# src/lib/jev/payload/AGENTS.md

Rules for building Jev request payloads, under [src/lib/jev/AGENTS.md](../AGENTS.md).

## What lives here

- [`canonical.ts`](canonical.ts) makes a payload's bytes: capped, ordered the same way every time, and safe to hash.
- [`answers.ts`](answers.ts) builds typed questions and reads each response back into a decision.
- [`menu.ts`](menu.ts) builds the option lists for a Choice.
- [`index.ts`](index.ts) is the one entry other files import from.

## Rules

- A payload is a nested state with the purpose first, then the decisive facts, then the context. Typed questions point at state fields by backticked path.
- Every walk over a payload stops at a fixed cap, so building, hashing, and sending stay bounded.
- Equal payloads must give equal bytes and equal hashes. The cache and the replay files depend on it.
- Write free text in plain words at about grade 6, and say what answer you want.
- Import from [`index.ts`](index.ts), not from the files beside it.
- A low confidence means the payload is wrong, not Jev. Add facts and motive to the state before you touch a bar.

## Checks

```bash
mise run test:file tests/jev/guards.test.ts tests/jev/framework-bounds.test.ts
mise run jev:check
```
