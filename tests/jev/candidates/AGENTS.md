# tests/jev/candidates/AGENTS.md

Eval cases for a decision that no code makes yet. The parent rules are in [tests/jev/AGENTS.md](../AGENTS.md).

## What lives here

- [`research.sentences.segmenter.json`](research.sentences.segmenter.json) holds the segmenter cases, kept as data for a later try at `research.sentences`.
- [`answer.figure.json`](answer.figure.json) holds the cases for the `answer` image arm. [answer-figure.eval.test.ts](../answer-figure.eval.test.ts) reads them. No decision owns them, because the arm reuses `image.router`.
- [`summarize.figure.json`](summarize.figure.json) holds the cases for the `summarize` image arm. [summarize-figure.eval.test.ts](../summarize-figure.eval.test.ts) reads them. No decision owns them either, because this arm also reuses `image.router`.

## Rules

- The eval check does not scan this folder. Move a file to [evals/](../evals/) only when a registered decision uses it.

## Checks

`mise run test:file tests/jev/evals-sync.test.ts`
