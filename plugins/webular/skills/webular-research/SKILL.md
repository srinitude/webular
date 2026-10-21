---
name: webular-research
description: Researches the web through the webular MCP tools. It searches without an API key, reads a page as clean Markdown, lists the pages on a site, and pulls key sentences from text. Use when a task needs facts from the web, the text of a URL, the pages of a site, or a short summary, and the webular tools are connected.
compatibility: Needs Bun and the webular MCP server from this plugin, over stdio or HTTP.
metadata:
  license: "Apache-2.0"
---

# Webular research

## Why

A web answer is only as good as its sources. This skill gets each fact from a page a tool returned, with the fewest tool calls, so the user can check every claim.

## Pick the tool

| Goal | Tool |
| --- | --- |
| Find pages on a topic | `search` |
| Read one page as Markdown | `scrape` |
| List the pages on a site | `map` |
| Shorten a text or a page | `summarize` |
| Read many pages of one site | `crawl` |
| Pull named fields from a page | `extract` |
| Get a short, sourced answer to one question | `answer` |
| Study a topic over many steps | `research` |
| Turn a file into text | `parse` |
| Get text or details from an image, audio, or video | `media` |
| Watch a page for changes | `monitor` |
| Run one tool on many inputs at once | `batch` |
| Click, type, or fill a form on a page | `act` |
| Read an RSS or Atom feed, even from a plain page URL | `feed` |

For the input fields, output shape, and errors of `search`, `scrape`, `map`, `summarize`, and `feed`, read [the tool reference](references/tools.md).

## Fallbacks the tools run for you

- `search` on the default `web` source falls back through Wikipedia, Hacker News, arXiv, Crossref, and OpenAlex, in that order. The result's `source` field names the one that answered. `WEBULAR_MAILTO` is optional: set it to an email address to put the Crossref and OpenAlex calls in their polite pools.
- `feed` takes a plain page URL. It reads the feed the page links to. If the page links none, it tries `/feed` and `/rss` on the same site. The result's `feedUrl` names the feed it read.
- `scrape` and `feed` take `archive: true`. When the live page fails, they read its closest Wayback Machine copy, and `archivedFrom` names that copy. Tell the user when a fact comes from an archived copy.
- `map` reads the site's sitemap, then the `Sitemap:` lines in `robots.txt`, then crawls links when no sitemap exists.

Don't call a second tool to redo a fallback the first one already ran.

## Workflow

Copy this checklist and tick each step:

```text
- [ ] 1. Write the question in one sentence, and what a good answer holds.
- [ ] 2. search, or map when you already know the site.
- [ ] 3. scrape the two or three best URLs.
- [ ] 4. Check that each fact you keep appears in a scraped page.
- [ ] 5. Answer with each fact next to its source URL.
```

## When a call fails

- The error says what failed and what to try next. Follow it once.
- An invalid URL fails before any request is sent. Pass the full `https://` form.
- A page that returns no text may need a browser. Say so, and don't guess what it says.

## Rules

- Quote only text a tool returned. Never invent a URL.
- Keep `limit` small (5 to 10) unless the user asks for more.
- When a fact matters, use `scrape` rather than a search snippet.

## Evals

The cases this skill must pass, with trigger and non-trigger queries, are in [the eval set](evals/evals.json).

## Done when

- [ ] Every fact in the answer sits next to a URL a tool returned.
- [ ] No URL in the answer was invented.
- [ ] Each failed call was retried once at most, as its error said.
