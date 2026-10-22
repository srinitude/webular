# site/AGENTS.md

The webular.dev website: a static Astro build served by Cloudflare Workers static assets. The repo rules are in the root [AGENTS.md](../AGENTS.md).

## Rules

- Build, check, and serve only through `mise run site:build`, `mise run site:test`, and `mise run site:dev`. `mise run site:deploy` needs a signed-in wrangler and the user's go-ahead, and it stays off the ci chain.
- This folder has its own [package.json](package.json) and [bun.lock](bun.lock), pinned to `astro@7.4.2`, `wrangler@4.151.3`, `playwright@1.64.1`, and `@axe-core/playwright@4.14.0`. Its [bunfig.toml](bunfig.toml) keeps the one-day release age ([Bun](https://bun.com/docs/pm/cli/install), tag `bun-v1.4.3`).
- No adapter: a static Astro site needs none ([Astro on Cloudflare](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)).
- [wrangler.jsonc](wrangler.jsonc) lists both custom domains, webular.dev and www.webular.dev ([Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)).
- Machine files are built, never copied by hand. The [scripts](scripts/) folder writes them from the repo and from the live MCP server.

## Checks

```bash
mise run site:test
```

## Children

- [public/AGENTS.md](public/AGENTS.md)
- [scripts/AGENTS.md](scripts/AGENTS.md)
- [src/AGENTS.md](src/AGENTS.md)
