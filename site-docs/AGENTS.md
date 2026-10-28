# site-docs/AGENTS.md

The Fumadocs site served at [webular.dev/docs](https://webular.dev/docs/), under the root [AGENTS.md](../AGENTS.md). It sits beside the Astro home page in [site/](../site/AGENTS.md) and ships in the same Cloudflare Worker.

## What lives here

- [package.json](package.json) and its own [bun.lock](bun.lock), pinned to `next@16.4.3`, `fumadocs-core@16.17.8`, `fumadocs-ui@16.17.8`, `fumadocs-mdx@15.4.10`, and `tailwindcss@4.3.3`. [bunfig.toml](bunfig.toml) keeps the one-day release age.
- [next.config.ts](next.config.ts): a static export (`output: 'export'`) with `basePath: '/docs'` and trailing slashes, so each page is `/docs/<slug>/index.html`.
- [app/](app/AGENTS.md): the pages, the search index and dialog, and the theme.
- [postcss.config.ts](postcss.config.ts) loads Tailwind; [tsconfig.json](tsconfig.json) is the one Next writes; [.gitignore](.gitignore) keeps build output and the content folder out of git.
- [scripts/docs-content.ts](../scripts/docs-content.ts) writes the pages into the content folder's docs folder, which is not in git.

## Rules

- Each page has one source. Site pages live in [docs/site/](../docs/site/AGENTS.md) at the path of their address. `MAPPED` in `docs-content.ts` renders benchmarks, the agent contract, and the changelog from their repo files, so repo [docs/](../docs/) links keep working. [scripts/docs-commands.ts](../scripts/docs-commands.ts) builds the 22 command pages from each command's `--help` and the fixture output that `mise run docs:outputs` records. Other `docs/*.md` files stay repo docs.
- Not chosen: keeping the source in that docs folder in git. The build writes that folder fresh, and moving `docs/*.md` would break repo links.
- `docs-content.ts --publish` copies the export into `site/dist/docs` and writes `/docs/llms.txt`, `/docs/llms-full.txt`, a `.md` twin per page, and `/docs/sitemap.xml` there. Every page footer has its git date, an edit link, and a GitHub issue link.
- The setup is a Next.js static export. `mise run docs:build` builds it into `site-docs/out`. `mise run site:build` runs neither the publish step nor [scripts/docs-links.ts](../scripts/docs-links.ts), so a home page deploy leaves the docs out.
- Why Next.js: the Fumadocs setup guide documents it first ([Next.js setup](https://www.fumadocs.dev/docs/manual-installation/next)), and the export needs one config line for output and one for the base path.
- Search is static: `staticGET` writes the index, and `staticClient` searches it in the browser ([Built-in Search](https://www.fumadocs.dev/docs/headless/search/orama)).
- The loader's base URL is `/`, because Next adds `/docs` to every link. A link in content is `/<slug>`, never `/docs/<slug>`.
- Styles read only the webular hero tokens in [app/webular-tokens.css](app/webular-tokens.css), copied from the design run's built tokens. Type is the hero's Georgia and system mono, so the docs load no font files.
- The light and dark palettes follow `data-theme`, as on the home page.
- The Next export hydrates with inline scripts. `--publish` moves each one, in place, to `/docs/_inline/<sha256>.js` ([scripts/docs-inline.ts](../scripts/docs-inline.ts)), so the site-wide content security policy covers `/docs` unchanged. Hashes in a `/docs` header do not fit: a long page has more than 40 inline scripts, past the 2,000-character line limit of `_headers` ([Cloudflare limits](https://developers.cloudflare.com/workers/static-assets/headers/)).

## Checks

```bash
mise run docs:build
mise run test:file tests/quality/docs-content.test.ts tests/quality/docs-commands.test.ts
```

## Children

- [app/AGENTS.md](app/AGENTS.md)
