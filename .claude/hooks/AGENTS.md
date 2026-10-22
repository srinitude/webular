# .claude/hooks/AGENTS.md

Claude Code adapter hooks. The parent [AGENTS.md](../AGENTS.md) says how the hooks are registered.

## What lives here

- `.claude/hooks/jev-docs-gate.ts`: the hook entry. It reads the edit and asks the rule for a verdict.
- `.claude/hooks/jev-docs-gate-rule.ts`: the pure decision, so its contract test needs no process.

## Rules

- Keep the decision pure and in the rule file. The entry only reads input and prints the verdict.
- Each hook has its own contract test.

## Checks

```bash
mise run test:file tests/jev/docs-gate-hook.test.ts tests/jev/docs-gate-situation.test.ts
```
