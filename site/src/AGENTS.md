# site/src/AGENTS.md

The Astro layout, components, and styles, under [site/AGENTS.md](../AGENTS.md).

## What lives here

- [Base.astro](Base.astro): the page shell that every route wraps, with the one page script.
- [DocMeta.astro](DocMeta.astro): the head tags and page links for a doc page.
- [RunLine.astro](RunLine.astro): one command to run, its Copy button, and a polite live region that says "Copied".
- [SearchRows.astro](SearchRows.astro): the real `search "sqlite wal"` rows and the Nice catch tag, shared by the home and docs heroes.
- [WebArt.astro](WebArt.astro): the web art, one inline SVG path drawn at build time; `torn` drops a wedge for the 404 page, and `labeled` adds tags: `true` for the home page's domains, or a list of names.
- [site.css](site.css): the page styles.
- [sections.css](sections.css): page sections, cards, doc pages, and the comparison table.
- [widths.css](widths.css): the layout changes at each width from the layout spec.
- [tabs.css](tabs.css): the install tabs, Copy, the theme toggle, the curl line breaks, the command group grid, and the "On this page" list.
- [tokens.css](tokens.css): the style tokens in both themes. The design-loop `build_platform_tokens` builder writes it from [tokens.json](../design/tokens.json).
- [grid.css](grid.css): the grid for each width. [tokens-css.ts](../scripts/tokens-css.ts) writes it from the same tokens.json.

## Rules

- Components are .astro files only, with no web fonts and no third-party script.
- The only client script is the small vanilla script in [Base.astro](Base.astro), with no framework. Astro ships it as a same-origin file, because the content security policy allows only `'self'` scripts. The one exception is the tiny inline head script that applies the saved theme before first paint. Its sha256 hash sits in `script-src` in [_headers](../public/_headers), so a change to that script needs a matching hash.
- Every style reads a custom property from [tokens.css](tokens.css) or [grid.css](grid.css).
- Styles are mobile first, and no page may scroll sideways at 320 px.

## Children

- [routes/AGENTS.md](routes/AGENTS.md)
- [content/AGENTS.md](content/AGENTS.md)
