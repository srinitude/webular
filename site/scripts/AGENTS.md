# site/scripts/AGENTS.md

Build and check scripts for the site, under [site/AGENTS.md](../AGENTS.md).

## What lives here

- [tools-json.ts](tools-json.ts) starts `webular mcp` and saves its tools/list reply for the tools page and tools.json.
- [tokens-css.ts](tokens-css.ts) writes two files from [tokens.json](../design/tokens.json). [grid.css](../src/grid.css) gets the grid rows, the panel corner radius, and the phone title size. [semantic.css](../src/semantic.css) gets the semantic light and dark colors. `mise run site:build` runs it, then Biome formats the output, so a rebuild leaves no diff. The design-loop `build_platform_tokens` builder writes [tokens.css](../src/tokens.css), not this script.
- [machine-files.ts](machine-files.ts) runs after the Astro build. It writes the twins, llms-full.txt, AGENTS.md, server.json, the sitemap, and security.txt.
- [check-site.ts](check-site.ts) is the check behind `mise run site:test`. It runs [width-checks.ts](width-checks.ts) at every width in [site-browser.ts](site-browser.ts), using the probes in [page-probes.ts](page-probes.ts). It prints pass and fail counts for each check at each width.
- [home-shots.ts](home-shots.ts) saves home, install, docs, and 404 page screenshots at 390, 1024, and 1440 px into the git-ignored `dist-shots` folder for a review by eye. Run `bun scripts/home-shots.ts` from the site folder after `mise run site:build`.
- [agents.txt](agents.txt) is the source of the served AGENTS.md. Its plain text name keeps it apart from this folder's own AGENTS.md.

## Rules

- The page weight limit is 100 KB gzip, measured with CompressionStream over the home HTML and its same-origin scripts and styles.
