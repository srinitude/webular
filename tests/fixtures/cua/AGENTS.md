# tests/fixtures/cua/AGENTS.md

This folder holds replies from the `cua-driver` tool, and it follows [tests/fixtures/AGENTS.md](../AGENTS.md).

- Each file is a real reply that was captured from a throwaway Chrome window: a window state, a visual-region parse, and two state checks.
- `tests/engine/cua-fixtures.test.ts` is the only reader. It decodes each reply with the same readers the action ladder in `src/lib/cua-ladder.ts` uses.
- Do not edit these files by hand. A hand-written reply would hide a change in the real tool.
