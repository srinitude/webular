# site/design/AGENTS.md

The design tokens for the site, under [site/AGENTS.md](../AGENTS.md).

## What lives here

- [tokens.json](tokens.json) holds every style token in the DTCG format. Its palette and semantic tiers come from the Catch Of The Day direction; [token-sources.json](token-sources.json) names where each other value came from. It has a palette tier, a theme tier with light and dark modes, type, space, size, radius, and motion. The grid rows for each width sit under `$extensions["dev.webular.grid"]`.
- The design-loop `build_platform_tokens` builder turns tokens.json into [tokens.css](../src/tokens.css).
- The script [tokens-css.ts](../scripts/tokens-css.ts) turns the grid rows into [grid.css](../src/grid.css).
- [token-sources.json](token-sources.json) gives each token in tokens.json, the grid rows included, its value, a source, a date, and how the source supports the value. A source is a repo file at a commit or a URL with the date it was read. A token with no source has `status: "unsourced"` and a reason.
- [doctor-output.json](doctor-output.json) holds the home hero's doctor output, line for line as a real run printed it.
- The home page and the docs in [site-docs/](../../site-docs/AGENTS.md) both import tokens.css, so they read one token source.

## Rules

- Change a token in [tokens.json](tokens.json), then rerun the builder and the script. Never edit [tokens.css](../src/tokens.css) or [grid.css](../src/grid.css) by hand.
- Give each added or changed token a fresh entry in [token-sources.json](token-sources.json). The gate [token-sources.test.ts](../../tests/quality/token-sources.test.ts) fails on a token with no entry or with a stale value.
