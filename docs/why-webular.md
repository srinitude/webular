# Why webular

Webular does what search and scrape services do, but it runs on your machine. This page says where it differs from Exa, Firecrawl, Perplexity, Tavily, Brave Search, and You.com, and where those tools do better.

Every rival fact comes from the vendor's own docs or pricing page, read on 2026-10-21. For scores, see [Benchmarks](benchmarks.md).

## What sets webular apart

### It runs on your machine

Webular is a Bun CLI plus an MCP server on your computer. No webular server sits in the middle.

It still uses the network. It calls the sites you ask for, Jev (only when a key is set), and public search sources such as DuckDuckGo, Wayback, Reddit, Hacker News, Crossref, and OpenAlex. Your queries reach those hosts.

You use Exa, Perplexity, Tavily, Brave, and You.com through their hosted APIs. Firecrawl can also be self-hosted.

Sources (2026-10-21): https://exa.ai/pricing, https://docs.tavily.com/, https://brave.com/search/api/

### One key: Jev (`TYPESAFE_API_KEY`)

The core jobs need no paid account. Without the key, each decision uses its rule-based baseline.

Each hosted rival needs its own key, and free tiers are capped. As of 2026-10-21, Firecrawl gives 1,000 free credits a month, and Tavily gives 1,000 free credits a month. Brave gives a $5 monthly credit and needs a credit card.

Sources (2026-10-21): https://www.firecrawl.dev/pricing, https://docs.tavily.com/documentation/api-credits, https://brave.com/search/api/

### One tool for every job

Webular has 20 commands, including scrape, crawl, map, extract, search, summarize, answer, and research. None of the rivals here lists all eight of those jobs:

- Exa lists no map, crawl, or summarize endpoint.
- Firecrawl has no standalone answer or summarize.
- Brave lists no scrape, crawl, map, extract, summarize, or research endpoint.

Sources (2026-10-21): https://exa.ai/docs/contents/quickstart, https://www.firecrawl.dev/pricing, https://brave.com/search/api/

### The whole tool is open source

Webular is Apache-2.0, all of it, so you can read and change every line. Firecrawl is AGPL-3.0.

Source (2026-10-21): https://github.com/firecrawl/firecrawl

### robots.txt is respected by default

Webular checks robots.txt before it fetches a page. A blocked page comes back with status `blocked` and reason `robots`, so you can see it. You can opt out with `scrape --ignore-robots`.

This page does not compare rivals on robots.txt, because their public pages do not state a policy we could confirm.

### Date-pinned replay

Webular can replay a run pinned to a date, with recorded Jev answers. `WEBULAR_AS_OF=YYYY-MM-DD` fixes the date. `WEBULAR_JEV_RECORD=1` records Jev answers, and `WEBULAR_JEV_REPLAY` plays them back. Only replay mode runs offline.

Live pages still change, so a live run can still differ.

### MCP server, plugin, and skills, all local

Webular ships an MCP server, a Claude Code plugin, and skills. MCP itself is not new: Exa and Brave also publish MCP servers. The difference is that those front hosted APIs, and this one runs on your machine.

Sources (2026-10-21): https://mcp.exa.ai/mcp, https://github.com/brave/brave-search-mcp-server

## Where others are ahead

- **Answers.** Exa scores higher than webular on `answer`. See [Benchmarks](benchmarks.md) for the run.
- **Speed.** Webular was slower than the scored rivals. See [Benchmarks](benchmarks.md).
- **Own indexes.** Exa, Brave, and Google run their own search indexes. Webular relies on free public sources, which can rate-limit.
- **Hard sites.** Firecrawl and other browser services are built to get past bot defenses. Webular was not tested on those sites.
- **SOC 2.** Exa, Firecrawl, and Brave cite SOC 2 Type II.
- **Remote MCP.** Exa runs a remote MCP server that needs no install. Webular needs an install.

Sources (2026-10-21): https://exa.ai/pricing, https://www.firecrawl.dev/pricing, https://brave.com/search/api/, https://mcp.exa.ai/mcp

## At a glance

Seen 2026-10-21.

- **Exa.** Hosted. Needs a key. No map, crawl, or summarize endpoint listed. https://exa.ai/pricing
- **Firecrawl.** Hosted or self-hosted. Needs a key, 1,000 credits a month free. AGPL-3.0. https://www.firecrawl.dev/pricing
- **Perplexity Sonar.** Hosted. Pay per request. Search, answer, research. https://docs.perplexity.ai/docs/getting-started/pricing
- **Tavily.** Hosted. Needs a key, 1,000 credits a month free. https://docs.tavily.com/faq/faq
- **Brave Search API.** Hosted, own index. Needs a key and a credit card for the $5 monthly credit. Search and answer. https://brave.com/search/api/
- **You.com API.** Hosted. Needs a key. Search, extract, answer, research. https://you.com/pricing

## Read next

- [How webular works](how-it-works.md)
- [Benchmarks](benchmarks.md)
