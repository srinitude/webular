# site-docs/app/AGENTS.md

The Next app for webular.dev/docs, under [site-docs/AGENTS.md](../AGENTS.md).

## What lives here

- [layout.tsx](layout.tsx): the root provider, the docs layout with its sidebar, and the theme switch.
- [source.ts](source.ts): the Fumadocs loader over `content/docs`, through the `fumadocs-mdx/macro` API.
- [search.tsx](search.tsx): the search dialog. It downloads the built index and searches it in the browser.
- [global.css](global.css): the theme. It maps each Fumadocs color, font, and radius to a webular hero token.
- [webular-tokens.css](webular-tokens.css): the hero tokens the theme reads, in light, dark, and reduced-motion modes.

## Children

- [[[...slug]]/AGENTS.md](<[[...slug]]/AGENTS.md>)
- [api/AGENTS.md](api/AGENTS.md)
