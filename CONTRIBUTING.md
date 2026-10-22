# Contributing to webular

Thanks for helping. This page covers setup, checks, and how a change lands. By taking part, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Set up

Install [mise](https://mise.jdx.dev). It pins Bun and every other tool in [mise.toml](mise.toml).

```bash
cd webular               # your clone of the repository
mise trust ./mise.toml   # once per clone
mise run setup           # frozen-lockfile install
bun bin/webular.ts scrape https://example.com --json
```

## Check your work

Run every check through `mise`. Do not call `bun test` or `bunx biome` by hand when a task exists.

```bash
mise run test:file tests/core   # only the tests you touched
mise run lint                   # Biome check
mise run format                 # Biome fixes (writes files)
mise run ci                     # setup, lint, typecheck, build, test, validate
```

Run `mise run ci` before you commit. [docs/development.md](docs/development.md) explains the test suite, including the opt-in live-internet cases.

## Rules that tests enforce

- Tests use real code and a local `Bun.serve` fixture. No mocks or stubs.
- A behavior change comes with a test or eval that fails without the change and passes with it.
- Files stay at or under 200 lines, functions and classes at or under 30, and nesting at depth 3.
- Write TypeScript only, with Effect. No export without an importer.
- Measure a change that affects speed or size before and after with `mise run bench`. Keep it only if the numbers and the tests both hold.
- Use American English, and names that say what a thing is.

[AGENTS.md](AGENTS.md) holds the full list. It also names what to ask first: dependencies, tool pins, [workflows](.github/workflows), exit codes, `--json` shapes, and MCP tool names.

## Send a pull request

1. Fork the repo and branch from `main`.
2. Make one focused change, and update the doc that describes it in the same commit.
3. Write commit subjects as [Conventional Commits](https://www.conventionalcommits.org/) with a scope, such as `fix(search): drop loopback hits`.
4. Open a pull request against `main`, and describe what changed and why. Never force-push to `main`.

For a large change, open an issue first so the design is agreed before you write code. Report a vulnerability through [SECURITY.md](SECURITY.md), never in a public issue.

## Where things live

- [README.md](README.md): what webular does.
- [docs](docs): user and developer docs.
- [GOVERNANCE.md](GOVERNANCE.md): how decisions are made.
- [SUPPORT.md](SUPPORT.md): where to ask questions.

Contributions are licensed under [Apache-2.0](LICENSE).
