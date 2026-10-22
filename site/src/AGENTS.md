# site/src/AGENTS.md

The Astro layout, components, and styles, under [site/AGENTS.md](../AGENTS.md).

## What lives here

- `Base.astro`: the page shell that every route wraps.
- `CommandGroups.astro`: the command list, grouped for the commands page.
- `DocMeta.astro`: the head tags and page links for a doc page.
- `InstallBlock.astro`: the install commands for each host.
- `site.css`: the page styles.
- `tokens.css`: the style tokens, written by the tokens-css.ts script from design/tokens.json.
- The a11y.css file holds the focus and contrast rules, and it loads after the page styles.

## Rules

- Components are .astro files only, with no client script, no web fonts, and no third-party script.
- Every style reads a custom property from [tokens.css](tokens.css). The design tokens replace that one file.
- Styles are mobile first, and no page may scroll sideways at 320 px.

## Children

- [routes/AGENTS.md](routes/AGENTS.md)
- [content/AGENTS.md](content/AGENTS.md)
