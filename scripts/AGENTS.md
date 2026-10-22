# scripts/AGENTS.md

The build and maintenance scripts that `mise` tasks run. The root [AGENTS.md](../AGENTS.md) holds the repo-wide rules.

## What lives here

- [gen-dispatch.ts](gen-dispatch.ts) writes [src/cli/dispatch-table.ts](../src/cli/dispatch-table.ts) from the `run:*` tasks in [`mise.toml`](../mise.toml). `mise run build` runs it first, and a test fails on drift.
- [clean.ts](clean.ts) deletes build output on every OS. `mise run build` runs it before each bundle.
- [jev-docs.ts](jev-docs.ts) refreshes and proves the Jev docs snapshot for `mise run jev:docs`.
- [repo-settings.ts](repo-settings.ts) applies (`mise run repo:settings`) or checks (`mise run repo:settings:check`, read-only) the GitHub description, homepage, and topics against [.github/repo-settings.json](../.github/repo-settings.json).
- [tasks-doc.ts](tasks-doc.ts) writes [docs/tasks.md](../docs/tasks.md) from `mise tasks --json` for `mise run docs:tasks`. `mise run docs:tasks:check` fails on drift.
- [bugs-check.ts](bugs-check.ts) runs the static bug-class guards for `mise run bugs:static`. [bugs-hunt.ts](bugs-hunt.ts) runs one class from [bugs-hunts.json](bugs-hunts.json) per `bugs:<class>` task, and every class for `mise run bugs:check`. A file in a rule's `known` list is a hit a fix still owes; remove it once fixed.
- [install.sh](install.sh) and [install.ps1](install.ps1) install a release binary.

## Rules

- Each script runs from a `mise` task. Add the task with the script.
- Scripts stay portable: the Windows task shell has no `rm`, `touch`, or glob expansion.

## Checks

- [jev-docs.ts](jev-docs.ts) ends with `Effect.runPromise(...)` instead of `BunRuntime.runMain`.

```bash
mise run build
mise run test:file tests/release tests/ci
```

## Children

- [bench/AGENTS.md](bench/AGENTS.md)
