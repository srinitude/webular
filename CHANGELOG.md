# Changelog

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Toolchain and packages move to their stable releases.
- CI checkout does not persist the token, and each job has a 30-minute timeout.
- `@types/diff` is dropped, since `diff` ships its own types.

### Added

- `effect` as a dependency.
- `docs/best-practices.md`, a checklist of the practices this repo follows. `tests/quality/practices-config.test.ts` and `tests/quality/practices-source.test.ts` check it.
- Dependabot for GitHub Actions and npm.
- `SECURITY.md` and this changelog.

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
