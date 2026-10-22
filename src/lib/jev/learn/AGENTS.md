# src/lib/jev/learn/AGENTS.md

Rules for call recording and lessons, under [src/lib/jev/AGENTS.md](../AGENTS.md).

## What lives here

- [`recorder.ts`](recorder.ts) writes one row per Jev call. It rotates the log at a byte cap and keeps a fixed number of rotated files.
- [`lessons.ts`](lessons.ts) proposes payload changes and keeps only the ones that prove better.
- [`lint.ts`](lint.ts) and [`definition-lint.ts`](definition-lint.ts) check payloads and decision definitions against the decision-model rules. Errors block a definition. Warnings advise.
- [`cli.ts`](cli.ts) runs `webular jev learn` and `webular jev correct`. [`src/commands/jev.ts`](../../../commands/jev.ts) calls it.

## Rules

- Record every call. Never sample.
- A row holds hashes, kinds, picks, and numbers. It never holds page text, state text, or a secret.
- A lesson counts only when held-out accuracy holds or rises and mean confidence rises. Proposals are payload transforms that code can repeat. Option order is not one.
- Kept lessons apply to every payload of that decision at once, through the recorder.
- `learn` tests lessons on the eval cases through the replay cache, set with `WEBULAR_JEV_REPLAY`. A cache miss is not a failure.
- `correct` labels one recorded call as an eval case. It never changes a bar.

## Checks

```bash
mise run test:file tests/jev/learn tests/jev/definition-lint.test.ts tests/commands/jev.test.ts
```
