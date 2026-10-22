# tests/jev/evals/AGENTS.md

This folder holds the eval cases for the Jev decisions, and it follows [tests/jev/AGENTS.md](../AGENTS.md).

- Each JSON file is named for one decision, such as [`tests/jev/evals/act.next.json`](act.next.json) for the `act.next` decision.
- [`tests/jev/evals/answer.figure.json`](answer.figure.json) holds the cases for the `answer` image arm.
- A decision names its file in its `evals` field. See [`src/lib/jev/picks.ts`](../../../src/lib/jev/picks.ts) for two of them.
- A case holds an input and the label a correct answer must carry.
- Tests such as [`tests/jev/cli-suggest.eval.test.ts`](../cli-suggest.eval.test.ts) import these files.
- You may edit a case by hand. Two files are the exception, because a script writes them: [`tests/jev/evals/answer.sentences.json`](answer.sentences.json) comes from [`scripts/bench/answer-sentences.ts`](../../../scripts/bench/answer-sentences.ts), and [`tests/jev/evals/research.sentences.json`](research.sentences.json) comes from [`scripts/bench/research-sentences.ts`](../../../scripts/bench/research-sentences.ts).
