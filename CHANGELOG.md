# Changelog

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Jev is the only key (`TYPESAFE_API_KEY`). Requests go to the direct TypeSafe endpoint, then the Pydantic AI Gateway, and `webular doctor` shows the route. Each request uses the pinned release `jev-1.14.0`.
- A robots.txt gate on `scrape`, `map`, `batch`, and `crawl`, checked on every redirect hop. `scrape --ignore-robots` opts out.
- Search levers, official-site lookup through Wikidata, and `WEBULAR_DETERMINISTIC=1` for a repeatable search.
- `answer` grounds each answer on a run date and routes images. `research` routes images too.
- Canonical URLs, gzip sitemaps, and JSON-LD facts in `map` and `scrape`.
- A plugin with four skills: research, interview, plain language, and Markdown.
- Windows, macOS, and Linux support, including musl, with per-shell key setup.
- A peer benchmark harness, with [the results](docs/benchmarks.md) and numbers generated from the committed run.
- [`docs/best-practices.md`](docs/best-practices.md), a checklist of the practices this repo follows. [`tests/quality/practices-config.test.ts`](tests/quality/practices-config.test.ts) and [`tests/quality/practices-source.test.ts`](tests/quality/practices-source.test.ts) check it.
- `effect` as a dependency.
- Dependabot for GitHub Actions and npm.
- [`SECURITY.md`](SECURITY.md) and this changelog.

### Changed

- `search` lists the failed sources and exits 1 when every source fails.
- `monitor` obeys robots.txt and reports `archivedFrom` with a warning.
- A `Retry-After` over the 10 s cap fails inside the deadline.
- An unreachable host fails with the network error.
- Agent mode confines output paths by default.
- `--select` names the missing fields, and an image-only PDF fails with an OCR hint.
- `--urls` is repeatable, and batch URLs must be http or https.
- MCP tool descriptions fit the token budget, and unknown tool input keys or a bad cursor return `isError`.
- Dates parse as UTC, and answers drop reference lines and lead with sentences that hold the asked answer.
- CI and the release use pinned actions, a 30-minute job timeout, a checkout that does not persist the token, and trusted publishing.
- Toolchain and packages move to their stable releases.

### Fixed

- Private and loopback hits no longer appear unless the query names the host.
- Hidden and invisible text no longer reaches page text, and a page with no main text falls back to its body text.
- Private addresses are guarded on every redirect, and auth headers do not cross hosts.
- Crawls check robots.txt before the root page.
- The PDF load deadline and caps fire, and a cap stops early with a note.
- Sitemap relative locs resolve, and Wayback picks the capture nearest in time.
- Workflow steps read the live environment, and an aborted step cancels.

### Removed

- MCP App views from the plugin and server.
- The direct Anthropic and OpenAI providers.
- `@types/diff`, since `diff` ships its own types.

## [0.2.0] - 2026-07-02

### Changed

- Breaking: a deterministic engine and a keyless fresh environment. Dead code and the `0.1.1` flags are gone.

## [0.1.1] - 2026-06-03

### Fixed

- Badges, stale library references, and the MCP dependency.

## [0.1.0] - 2026-06-03

### Added

- A universal web research CLI, routed through mise into Mastra workflows built on free and open-source libraries.

[Unreleased]: https://github.com/srinitude/webular/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/srinitude/webular/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/srinitude/webular/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/srinitude/webular/releases/tag/v0.1.0
