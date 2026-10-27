# docs/site/AGENTS.md

The source of the pages written for webular.dev/docs, under [docs/AGENTS.md](../AGENTS.md). [site-docs/AGENTS.md](../../site-docs/AGENTS.md) says where every other page's source lives.

## What lives here

- One `.mdx` file per page, at the path of its address: `index.mdx` is `/docs`.
- First run: [index.mdx](index.mdx), [install.mdx](install.mdx), [quickstart.mdx](quickstart.mdx), [concepts.mdx](concepts.mdx), and [jev.mdx](jev.mdx).
- Benchmarks and project: [compare.mdx](compare.mdx), [troubleshooting.mdx](troubleshooting.mdx), [security.mdx](security.mdx), [contributing.mdx](contributing.mdx), [support.mdx](support.mdx), and [glossary.mdx](glossary.mdx).
- `mise run docs:build` copies each file into `site-docs/content/docs/` and adds its footer.

## Rules

- The page list and order follow the docs IA. Its content spec says what each page holds.
- The first code block is a command the reader can run. A page with no command says why in one line.
- Every command, flag, exit code, setting, and output comes from the code or real `--help` output.
- Links between pages leave out `/docs`: write `/install`, not `/docs/install`.
- `<Tabs>` and `<Tab>` work with no import.
- Plain words, about U.S. grade 6, in American English. Code and data stay exact.

## Children

- [agents/AGENTS.md](agents/AGENTS.md)
- [guides/AGENTS.md](guides/AGENTS.md)
- [reference/AGENTS.md](reference/AGENTS.md)
