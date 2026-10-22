# tests/jev/candidates/AGENTS.md

Eval cases for a decision that no code makes yet. The parent rules are in [tests/jev/AGENTS.md](../AGENTS.md).

## What lives here

- [`research.sentences.segmenter.json`](research.sentences.segmenter.json) holds the segmenter cases, kept as data for a later try at `research.sentences`.

## Rules

- The eval check does not scan this folder. Move a file to [evals/](../evals/) only when a registered decision uses it.

## Checks

`mise run test:file tests/jev/evals-sync.test.ts`
