# Why webular

Webular does what search and scrape services do, but it runs on your machine. This page says where it differs from Exa, Firecrawl, Perplexity, Tavily, Brave Search, and You.com, and where those tools do better.

Every rival fact comes from the vendor's own docs or pricing page, read on 2026-10-21. For scores, see [Benchmarks](benchmarks.md).

## What sets webular apart

### It runs on your machine

Webular is a Bun CLI plus an MCP server on your computer. No webular server sits in the middle.

It still uses the network. It calls the sites you ask for, Jev (only when a key is set), and public search sources such as DuckDuckGo, Wayback, Reddit, Hacker News, Crossref, and OpenAlex. Your queries reach those hosts.

Exa, Perplexity, Tavily, Brave, and You.com are hosted only. Firecrawl can also be self-hosted.

Sources (2026-10-21): https://exa.ai/pricing, https://docs.tavily.com/, https://brave.com/search/api/

### One key: Jev (`TYPESAFE_API_KEY`)

The core jobs need no paid account. Without the key, each decision uses its rule-based baseline.

Each hosted rival needs its own key, and free tiers are capped. Firecrawl gives 1,000 credits a month, and Tavily gives 1,000 credits a month.

Sources (2026-10-21): https://www.firecrawl.dev/pricing, https://docs.tavily.com/documentation/api-credits

### One tool for every job

Webular has 20 commands, including scrape, crawl, map, extract, search, summarize, answer, and research. None of the rivals here lists all eight of those jobs:

- Exa has no map.
- Firecrawl has no standalone answer or summarize.
- Brave has no scrape, crawl, map, extract, or research.

Sources (2026-10-21): https://exa.ai/docs/contents/quickstart, https://www.firecrawl.dev/pricing, https://brave.com/search/api/

### The whole tool is open source

Webular is Apache-2.0, all of it. Exa, Perplexity, Tavily, Brave, and You.com are closed services. Some of them publish only an MCP server or SDK as open source. Firecrawl is AGPL-3.0.

Source (2026-10-21): https://github.com/firecrawl/firecrawl

### robots.txt is respected by default

Webular checks robots.txt before it fetches a page. A blocked page comes back with status `blocked` and reason `robots`, so you can see it. You can opt out with `scrape --ignore-robots`.

- Firecrawl respects robots.txt by default, with an override.
- Perplexity says its user agent "generally ignores" it.
- Exa, Tavily, Brave, and You.com state nothing in their public docs.

Sources (2026-10-21): https://docs.firecrawl.dev/api-reference/endpoint/crawl-post, https://docs.perplexity.ai/docs/resources/perplexity-crawlers

### Date-pinned replay

Webular can replay a run pinned to a date, with recorded Jev answers. `WEBULAR_AS_OF=YYYY-MM-DD` fixes the date. `WEBULAR_JEV_RECORD=1` records Jev answers, and `WEBULAR_JEV_REPLAY` plays them back. Only replay mode runs offline.

Live pages still change, so a live run can still differ.

Rivals offer cache freshness, not a date pin: Exa has `maxAgeHours`, and Firecrawl has `maxAge`.

Source (2026-10-21): https://exa.ai/docs/contents/quickstart

### MCP server, plugin, and skills, all local

Webular ships an MCP server, a Claude Code plugin, and skills. Most rivals also have an official MCP server, so MCP itself is not new. The difference: theirs mostly front a hosted API, and this one runs on your machine.

Sources (2026-10-21): https://mcp.exa.ai/mcp, https://github.com/brave/brave-search-mcp-server

## Where others are ahead

- **Answers.** Exa scores higher than webular on `answer`. See [Benchmarks](benchmarks.md) for the run.
- **Speed.** Webular was slower than the scored rivals. See [Benchmarks](benchmarks.md).
- **Own indexes.** Exa, Brave, and Google run their own search indexes. Webular relies on free public sources, which can rate-limit.
- **Hard sites.** Firecrawl and other browser services are built to get past bot defenses. Webular was not tested on those sites.
- **SOC 2.** Exa, Firecrawl, and Brave cite SOC 2 Type II. Exa, Firecrawl, Brave, and You.com offer zero data retention.
- **Remote MCP.** Exa, Tavily, and You.com run remote MCP servers that need no install. Webular needs an install.

Sources (2026-10-21): https://exa.ai/pricing, https://www.firecrawl.dev/pricing, https://brave.com/search/api/, https://you.com/pricing

## At a glance

Seen 2026-10-21.

- **Exa.** Hosted. Needs a key. Closed. Every job but map. No robots policy stated. Cache freshness only. https://exa.ai/pricing
- **Firecrawl.** Hosted or self-hosted. Needs a key, 1,000 credits a month free. AGPL-3.0. Respects robots.txt by default. https://www.firecrawl.dev/pricing
- **Perplexity Sonar.** Hosted. Pay per request. Closed. Search, answer, research. Its user agent ignores robots.txt. https://docs.perplexity.ai/docs/getting-started/pricing
- **Tavily.** Hosted. Needs a key, 1,000 credits a month free. Closed. No date pin found. https://docs.tavily.com/faq/faq
- **Brave Search API.** Hosted, own index. Needs a key. Closed. Search, answer, summarize. https://brave.com/search/api/
- **You.com API.** Hosted. Needs a key. Closed. Search, extract, answer, research. Freshness filter only. https://you.com/pricing

## Read next

- [How webular works](how-it-works.md)
- [Benchmarks](benchmarks.md)
