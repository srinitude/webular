---
name: webular-research
description: Researches the web through the webular MCP tools. It searches without an API key, reads a page as clean Markdown, lists the pages on a site, and pulls key sentences from text. Use when a task needs facts from the web, the text of a URL, the pages of a site, or a short summary, and the webular tools are connected.
compatibility: Needs Bun and the webular MCP server from this plugin, over stdio or HTTP.
metadata:
  license: "Apache-2.0"
---

# Webular research

## Why

A web answer is only as good as its sources. This skill takes each fact from a page a tool returned. It uses as few tool calls as it can. The user can check every claim.

## When the tools are not there yet

The webular MCP server can take a few seconds to start. If no webular tool is in your tool list yet, the server is still connecting. Do not stop there, and do not answer without the tools.

1. List the webular server's MCP resources once. If you have no tool for that, load this skill once more. Either call gives the server time to connect.
2. Call the webular tool you need. It is listed by then.
3. Only if the tools are still missing after that, say the webular server did not connect.

## Pick the tool

| Goal | Tool |
| --- | --- |
| Find pages on a topic | `search` |
| Read one page as Markdown | `scrape` |
| Read two or more URLs in one call, never one `scrape` per URL | `batch` |
| List the pages on a site | `map` |
| Shorten a text or a page | `summarize` |
| Read many pages of one site | `crawl` |
| Pull named fields from a page | `extract` |
| Get a short, sourced answer to one question | `answer` (`urls` reads only those pages) |
| Research a topic. Call this first, not `search` and then `scrape` | `research` |
| Turn a file into text | `parse` |
| Get text or details from an image, audio, or video | `media` |
| Watch a page for changes | `monitor` |
| Click, type, or fill a form on a page | `act` |
| Read an RSS or Atom feed, even from a plain page URL | `feed` |
| Check that webular and its tools are set up | `doctor` |
| List the mise tasks webular runs | `tasks` |
| List the state machines that model the flows | `diagram` |
| See whether the security scan tool is installed | `audit` |

For the input fields, output shape, and errors of `search`, `scrape`, `map`, `summarize`, and `feed`, read [the tool reference](references/tools.md).

## Fallbacks the tools run for you

The tools retry on their own in these ways.

- `search` on the default `web` source falls back through Wikipedia, Hacker News, arXiv, Crossref, and OpenAlex, in that order. The result's `source` field names the one that answered. `WEBULAR_MAILTO` is optional: set it to an email address to put the Crossref and OpenAlex calls in their polite pools.
- `feed` takes a plain page URL. It reads the feed the page links to. If the page links none, it tries `/feed` and `/rss` on the same site. The result's `feedUrl` names the feed it read.
- `scrape` and `feed` take `archive: true`. When the live page fails, they read its closest Wayback Machine copy. `archivedFrom` names that copy. Tell the user when a fact comes from an archived copy.
- `map` reads the site's sitemap, then the `Sitemap:` lines in `robots.txt`, then crawls links when no sitemap exists.
- A result too long for one reply comes back cut, with `truncated: true` and a `cursor`. Call the same tool again with the same input and that `cursor` for the next page.

Do not call a second tool to redo a fallback the first one already ran.

## Workflow

Copy this checklist. Tick each step.

```text
- [ ] 1. Write the question in one sentence, and what a good answer holds.
- [ ] 2. If the task says to research a topic, call research and go to step 4. Otherwise search, or map when you already know the site.
- [ ] 3. Read the two or three best URLs in one batch call.
- [ ] 4. Check that each fact you keep appears in a page a tool returned.
- [ ] 5. Answer with each fact next to its source URL.
```

## When a call fails

- The error says what failed and what to try next. Follow it once.
- An invalid URL fails before any request is sent. Pass the full `https://` form.
- A page that returns no text may need a browser. Say so. Do not guess what it says.

## Rules

- Quote only text a tool returned. Never invent a URL.
- Keep `limit` small (5 to 10) unless the user asks for more.
- When a fact matters, read the page with `scrape` or `batch` rather than trust a search snippet.

## Evals

The cases this skill must pass, with trigger and non-trigger queries, are in [the eval set](evals/evals.json).

## Done when

- [ ] Every fact in the answer sits next to a URL a tool returned.
- [ ] No URL in the answer was invented.
- [ ] Each failed call was retried once at most, as its error said.
