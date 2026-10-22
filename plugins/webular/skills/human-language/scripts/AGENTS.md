# plugins/webular/skills/human-language/scripts/AGENTS.md

This folder holds the word rules of the human-language skill as code. The skill rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- [`plugins/webular/skills/human-language/scripts/plain.ts`](plain.ts) exports `plainText` for the Jev payload pass and `proseIssues` for the readability lint. Code spans in backticks are never changed or judged.
- [`plugins/webular/skills/human-language/scripts/words.json`](words.json) holds the sentence-length cap, the word swaps, and the words to cut.

## Rules

- Edit word lists in [`words.json`](words.json). Keep [`plain.ts`](plain.ts) free of word lists.
- Both exports read the same rules, so the payload pass and the lint never disagree.

## Checks

- `mise run plugin:code-limits` does not scan this folder, so run `mise run plugin:lint` and `mise run plugin:test` after an edit.
