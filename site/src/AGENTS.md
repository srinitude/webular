# site/src/AGENTS.md

The Astro layout, components, and styles, under [site/AGENTS.md](../AGENTS.md).

## What lives here

- [Base.astro](Base.astro): the page shell that every route wraps, with the one page script.
- [CommandGroups.astro](CommandGroups.astro): the command list, grouped for the commands page.
- [DocMeta.astro](DocMeta.astro): the head tags and page links for a doc page.
- [InstallBlock.astro](InstallBlock.astro): the install commands for each host.
- [site.css](site.css): the page styles.
- [sections.css](sections.css): page sections, cards, doc pages, and the comparison table.
- [widths.css](widths.css): the layout changes at each width from the layout spec.
- [tabs.css](tabs.css): the install tabs, Copy, the theme toggle, the curl line breaks, the command group grid, and the "On this page" list.
- [tokens.css](tokens.css): the style tokens, written by [tokens-css.ts](../scripts/tokens-css.ts) from [tokens.json](../design/tokens.json).

## Rules

- Components are .astro files only, with no web fonts and no third-party script.
- The only client script is the small vanilla script in [Base.astro](Base.astro), with no framework. Astro ships it as a same-origin file, because the content security policy allows only `'self'` scripts.
- Every style reads a custom property from [tokens.css](tokens.css). The design tokens replace that one file.
- Styles are mobile first, and no page may scroll sideways at 320 px.

## Children

- [routes/AGENTS.md](routes/AGENTS.md)
- [content/AGENTS.md](content/AGENTS.md)
