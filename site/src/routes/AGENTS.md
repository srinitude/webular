# site/src/routes/AGENTS.md

One route per file, added by the integration in the Astro config (a pages folder would also render this AGENTS.md as a page), under [site/src/AGENTS.md](../AGENTS.md).

## What lives here

- `404.astro` and `index.astro`: the not-found page and the home page.
- `agents.astro`, `benchmarks.astro`, `commands.astro`, `docs.astro`, and `tools.astro`: the reference pages.
- `install.astro`, `keys.astro`, `privacy.astro`, `security.astro`, and `support.astro`: the setup and policy pages.
- The agents page twin lives at agents/index.md, so its URL is /agents/index.md.

## Rules

- A doc page renders its Markdown from the content folder, so the page and its .md twin come from one source.
- The home hero command keeps `id="hero-command"`. The site check looks for it at every width.
