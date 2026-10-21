# Webular tool reference

| Section | Use when | Do not use when | Related |
| --- | --- | --- | --- |
| [Connect](#connect) | You need to start or reach the server. | The tools are already listed. | [Errors](#errors) |
| [search](#search) | You need pages on a topic. | You already have the URL. | [scrape](#scrape) |
| [scrape](#scrape) | You need the text of one page. | You need many pages at once. | [map](#map) |
| [map](#map) | You need the list of pages on a site. | You need page text. | [scrape](#scrape) |
| [summarize](#summarize) | You need the key sentences of a text or page. | You need the full text. | [scrape](#scrape) |
| [feed](#feed) | You need the posts of a site or feed. | You need one page's full text. | [scrape](#scrape) |
| [Errors](#errors) | A call failed. | The call worked. | [Connect](#connect) |

## Connect

- For stdio, run `bun ./src/server.ts` from the plugin folder.
- For HTTP, run `mise run plugin:dev` from the repo root. Portless then serves it at `https://webular-mcp.localhost/mcp`.
- Without portless, run `bun ./src/server.ts --http`. It listens on `http://127.0.0.1:$PORT/mcp`, and the port is 3939 when `PORT` is not set.
- Run `mise run build` once. Each tool call then starts a prebuilt command file, which starts much faster than the source files. Set `WEBULAR_DEV=1` to run the source files instead.

## search

- Input: `query` (text, required), `limit` (1 to 50, default 10), and `source` (`web`, `wikipedia`, `hackernews`, `arxiv`, `crossref`, or `openalex`, default `web`).
- Output: a list of results, each with a title, a URL, and a snippet, plus `source`, the source that answered.
- When a source fails or finds nothing, the default `web` source falls back through the others in that order.
- It needs no API key. `WEBULAR_MAILTO` is optional: an email address that puts the Crossref and OpenAlex calls in their polite pools.

## scrape

- Input: `url` (a full http or https URL, required) and `archive` (true or false).
- Output: the page title and its main content as Markdown, with no menus or ads.
- With `archive: true`, a page that fails live is read from its closest Wayback Machine copy, and `archivedFrom` names that copy.

## map

- Input: `url` (required) and `limit` (1 to 10,000).
- Output: the URLs on the same host.
- It reads the site's sitemap, then the `Sitemap:` lines in `robots.txt`, then crawls links when no sitemap exists.

## summarize

- Input: `text` or `url` (one of them is required) and `sentences` (1 to 25, default 3).
- Output: the key sentences, picked without a model call.

## feed

- Input: `url` (a feed URL or a plain page URL, required), `limit` (1 to 500, default 20), and `archive` (true or false).
- Output: the feed title and its items, each with a title, link, date, and summary, plus `feedUrl`, the feed it read.
- A plain page URL works. It reads the feed the page links to, then tries `/feed` and `/rss` on the same site.
- With `archive: true`, a dead URL is read from its closest Wayback Machine copy, and `archivedFrom` names that copy.

## Errors

- An input that breaks the schema fails before any request is sent. The message names the field, such as `url: Invalid URL`.
- When a command rejects its input (exit code 2), the tool returns `webular <command> failed: <why>. Fix the input and call it again.`
- When a command fails for any other reason, the message ends with `The input looked valid. Try another URL, or tell the user the site could not be read.`
- When the server cannot start a command, the message starts with `webular <command> could not start`.
