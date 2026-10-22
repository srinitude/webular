# plugins/webular/skills/rich-and-native-markdown/scripts/AGENTS.md

This folder holds the file checker of the rich-and-native-markdown skill. The skill rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- [`plugins/webular/skills/rich-and-native-markdown/scripts/check.ts`](check.ts) checks line limits, local link targets, anchors, and an optional reading graph.
- It prints JSON and exits 1 on errors. Run it as `bun check.ts [--manifest manifest.json] <files...>`.

## Rules

- Keep the checker mechanical. It reports; it does not rewrite.
- [`plugins/webular/tests/markdown-check.test.ts`](../../../tests/markdown-check.test.ts) and [`plugins/webular/tests/markdown-evals.test.ts`](../../../tests/markdown-evals.test.ts) import `checkMarkdown` from it.

## Checks

- `mise run plugin:test` runs both tests.
- `mise run plugin:lint` checks the style of the file.
