## What changed and why

## Checks run

Paste the real output of each check.

- [ ] `mise run test:file` on the tests I touched
- [ ] `mise run lint`
- [ ] `mise run ci`

## Checklist

- [ ] The title and every commit follow Conventional Commits with a scope, such as `fix(search): drop loopback hits`.
- [ ] A change in behavior comes with an eval or test that fails before it and passes after.
- [ ] The tests use real code on a local `Bun.serve` fixture, with no mocks or stubs.
- [ ] Files stay at 200 lines, constructs at 30 lines, and nesting at depth 3 ([docs/development.md](../docs/development.md)).
- [ ] I ran `mise run bench` on the same input before and after. I keep the change only because the numbers and the tests both hold.
- [ ] Markdown files went through the Markdown chain.
- [ ] No secrets, no `dist/`, `bench/results/`, or `bench/recordings/` files, and no AI co-attribution.
- [ ] A new folder has an AGENTS.md and a CLAUDE.md that holds `@AGENTS.md`.
