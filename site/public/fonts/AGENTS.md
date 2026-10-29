# site/public/fonts/AGENTS.md

The self-hosted brand fonts, under [site/public/AGENTS.md](../AGENTS.md).

## What lives here

- [archivo-black-400.latin.woff2](archivo-black-400.latin.woff2): Archivo Black, the heading face behind `--font-display`.
- [space-mono-400.latin.woff2](space-mono-400.latin.woff2) and [space-mono-700.latin.woff2](space-mono-700.latin.woff2): Space Mono regular and bold, the body and code face behind `--font-mono` and `--font-sans`.
- [OFL-archivo-black.txt](OFL-archivo-black.txt) and [OFL-space-mono.txt](OFL-space-mono.txt): the SIL Open Font License for each family, copied from the [Google Fonts repo](https://github.com/google/fonts/tree/main/ofl).

## Rules

- Each file is a Latin-only WOFF2 subset of the upstream TTF, made with `pyftsubset` from fonttools. The `unicode-range` in [fonts.css](../../src/fonts.css) lists the same code points.
- Keep each license file beside its fonts. Neither license names a Reserved Font Name, so the subsets keep the family names.
- The head preloads only the two faces the first view draws, Archivo Black and Space Mono regular.
