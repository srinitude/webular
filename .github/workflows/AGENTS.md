# .github/workflows/AGENTS.md

The GitHub Actions workflows. The parent [AGENTS.md](../AGENTS.md) lists the rest of the GitHub settings.

## What lives here

- `.github/workflows/ci.yml`: runs `mise run ci` and `mise run e2e` on Linux, macOS, and Windows, and builds the executable on each.
- `.github/workflows/plugin.yml`: runs the plugin chain.
- `.github/workflows/release.yml`: builds and publishes a release, with an attested SPDX SBOM and npm provenance.
- `.github/workflows/codeql.yml`: CodeQL analysis of the JavaScript and TypeScript sources on push to main, on pull requests, and weekly.
- `.github/workflows/repo-settings.yml`: read-only weekly check that the GitHub description, homepage, and topics match [`.github/repo-settings.json`](../repo-settings.json). `mise run repo:settings` applies the file by hand.
- `.github/workflows/scorecard.yml`: OpenSSF Scorecard on push to main and weekly, published and uploaded to code scanning.
- `.github/workflows/prune.yml`: runs `mise run prune:check` on pull requests and weekly. A failed weekly run opens a draft pull request from a `prune/auto-*` branch with the `mise run prune:fix` result. It never pushes to main.

## Rules

- A workflow runs `mise` tasks only. Tool versions come from [`mise.toml`](../../mise.toml), never from a workflow.
- Pin every action to a full commit SHA, with its tag in a comment.
- Start each workflow with `permissions: {}` or `contents: read`. Grant each job only the `permissions` it needs, and set `persist-credentials: false` on checkout.
- Every job sets `timeout-minutes`, because the default is 360 ([GitHub Actions](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)).
- Every workflow sets a `concurrency` group. Use `cancel-in-progress: true` for checks and `false` for releases ([GitHub Actions](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)).
- Cache `BUN_INSTALL_CACHE_DIR`, keyed on [`mise.toml`](../../mise.toml) and [`bun.lock`](../../bun.lock), and still run `bun install --frozen-lockfile` ([Bun](https://bun.com/docs/pm/cli/install), tag `bun-v1.4.3`).
- Pass `${{ }}` values through `env:`, never inline in `run:` ([GitHub security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)).
- Never use `pull_request_target` or `workflow_run` with untrusted code.
- No `bun -e` or `node -e` steps ([`tests/quality/typescript-only.test.ts`](../../tests/quality/typescript-only.test.ts)).
- The main branch moves only by fast-forward, after CI is green on all three systems.

## Checks

```bash
mise run test:file tests/ci tests/release
```
