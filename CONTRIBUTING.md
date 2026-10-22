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

## Keep README, settings, and docs current

Every public page about webular must match the code. Checks catch the drift, so a stale page fails the build. Change the code and the text that describes it in the same commit.

- **README and docs.** Tests compare the commands, flags, MCP tools, env vars, platforms, and install commands in `README.md`, `docs/install.md`, and `docs/commands.md` with the code. `mise run test` runs them.
- **Package and plugin text.** The `description` in `package.json` is the one short description. A test fails when `CITATION.cff`, the plugin manifest, or the marketplace text says something else.
- **GitHub repo settings.** `.github/repo-settings.json` holds the About box: description, homepage, and topics. `mise run repo:settings` applies the file to GitHub. `mise run repo:settings:check` compares the live repo with the file and changes nothing. The workflow `.github/workflows/repo-settings.yml` runs that check each week and on every push to `main`, with a read-only token.
- **Benchmark numbers.** Numbers live only in the generated blocks of `README.md` and `docs/benchmarks.md`. Run `mise run bench:docs` to rewrite those blocks from the committed peer run with the highest timestamp in `bench/results`. Never type a number by hand.
- **Models and docs.** Checks keep every model and every doc in sync with the code. When one fails, fix the text or the code until `mise run test` passes.
- **API keys.** Jev is the only API key webular uses. The guard test `tests/quality/only-jev-key.test.ts` fails when code reads any other key.

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
