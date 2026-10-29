# site/design/AGENTS.md

The design tokens for the site, under [site/AGENTS.md](../AGENTS.md).

## What lives here

- [tokens.json](tokens.json) holds every style token in the DTCG format. Its values come from the Catch Of The Day direction. It has a palette tier, a theme tier with light and dark modes, type, space, size, radius, and motion. The grid rows for each width sit under `$extensions["dev.webular.grid"]`.
- The design-loop `build_platform_tokens` builder turns tokens.json into [tokens.css](../src/tokens.css).
- The script [tokens-css.ts](../scripts/tokens-css.ts) turns the grid rows into [grid.css](../src/grid.css).
- The home page and the docs in [site-docs/](../../site-docs/AGENTS.md) both import tokens.css, so they read one token source.

## Rules

- Change a token in [tokens.json](tokens.json), then rerun the builder and the script. Never edit [tokens.css](../src/tokens.css) or [grid.css](../src/grid.css) by hand.
