# site/design/AGENTS.md

The design tokens for the site, under [site/AGENTS.md](../AGENTS.md).

## What lives here

- [hero-tokens.css](hero-tokens.css) holds the hero tokens from the design run's tokens stage. The home page and the docs in [site-docs/](../../site-docs/AGENTS.md) both import it, so they read one token source.
- [tokens.json](tokens.json) holds the colors and other tokens the home page styles still use, in the DTCG format. The script [tokens-css.ts](../scripts/tokens-css.ts) turns it into [tokens.css](../src/tokens.css).

## Rules

- Never edit [hero-tokens.css](hero-tokens.css) by hand. Change the design run's tokens, rebuild them, and copy the built file here whole.
- Change a token in [tokens.json](tokens.json), then rerun the script. Never edit [tokens.css](../src/tokens.css) by hand.
