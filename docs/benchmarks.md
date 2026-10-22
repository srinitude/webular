# Benchmarks

**What this measures:** webular and paid web research tools, such as Exa, Tavily, Firecrawl, and Perplexity, get the same small set of web jobs. Each answer is checked against a known right answer. The page reports how often each tool was right, how long it took, and what it cost.

**Why it matters:** it shows where webular is as good as the paid tools, and where it falls short. Losses are shown as plainly as wins.

**How to read the numbers:** most scores run from 0 (no answers right) to 1 (every answer right). A missing score is not a zero; it means the tool did not run that job. The task sets are small, so read this as one small run, not as a final ranking. [How to read the benchmarks](benchmarks-guide.md) explains every term on this page.

Every number here comes from one saved results file, and each one links to that file. On webular's side, every score comes from its own open-source parts and Jev, TypeSafe's small decision model, with no paid web API. [The README](../README.md) lists what webular is built on.

## Source files

<!-- bench:start run -->
All numbers on this page except the agent matrix come from one committed peer run, with 3 runs per task. Its sha256 fingerprint, which changes if the file changes, is `65bcfa20edf7`.

- [Full results of the peer run from Oct. 22, 2026 at 17:42 UTC](../bench/results/peers-2026-10-22T17-42-50-204Z.json): one row per tool, task, and run, with its status and accuracy.
- [Text report of the same run](../bench/results/peers-2026-10-22T17-42-50-204Z.txt): the harness's summary, with the per-peer tables.
<!-- bench:end -->

The results file holds no confidence intervals, no paired tests, and no p values. Those are the math checks that would show whether a difference is real or just luck. So this page gives none, and it calls no win or loss proven. The command `mise run bench:docs` writes every number on this page from the results file, and a test fails when a number here differs from that file.

## Short answer

Each line is one job, such as search or scrape. The score is mean accuracy: the share of answers graded right, from 0 to 1, averaged over each task's runs and then over its tasks.

<!-- bench:start short -->
- **act:** webular scores 0.000 on 1 task. No rival scored this job, so there is nothing to compare.
- **answer:** webular scores 1.000 on 7 tasks; exa scores 1.000 on 7 tasks. Webular is even with the best rival, exa.
- **batch:** webular scores 1.000 on 4 tasks; exa scores 1.000 on 3 tasks; firecrawl scores 1.000 on 3 tasks. Webular is even with the best rival, exa.
- **crawl:** webular scores 0.500 on 2 tasks; firecrawl scores 0.000 on 1 task. Webular is ahead of the best rival, firecrawl.
- **extract:** webular scores 1.000 on 3 tasks; firecrawl scores 1.000 on 3 tasks. Webular is even with the best rival, firecrawl.
- **map:** webular scores 0.667 on 3 tasks; firecrawl scores 0.333 on 3 tasks. Webular is ahead of the best rival, firecrawl.
- **media:** webular scores 1.000 on 2 tasks; firecrawl scores 1.000 on 1 task. Webular is even with the best rival, firecrawl.
- **monitor:** webular scores 0.333 on 1 task. No rival scored this job, so there is nothing to compare.
- **parse:** webular scores 1.000 on 1 task; firecrawl scores 1.000 on 1 task. Webular is even with the best rival, firecrawl.
- **research:** webular scores 1.000 on 3 tasks; exa scores 1.000 on 3 tasks. Webular is even with the best rival, exa.
- **scrape:** webular scores 1.000 on 6 tasks; exa scores 1.000 on 2 tasks; firecrawl scores 0.667 on 3 tasks; readability scores 0.333 on 3 tasks. Webular is even with the best rival, exa.
- **search:** webular scores 1.000 on 4 tasks; exa scores 1.000 on 4 tasks; firecrawl scores 1.000 on 4 tasks. Webular is even with the best rival, exa.
- **summarize:** webular scores 0.500 on 2 tasks; exa scores 0.000 on 1 task. Webular is ahead of the best rival, exa.
- **Where webular leads:** it runs offline, needs 0 keys, and costs 0 USD per call. Source: [the text report](../bench/results/peers-2026-10-22T17-42-50-204Z.txt).
Source for every job score above: [the peer run from Oct. 22, 2026 at 17:42 UTC](../bench/results/peers-2026-10-22T17-42-50-204Z.json).
<!-- bench:end -->

## What ran

<!-- bench:start ran -->
The run has 39 tasks: 4 search, 6 scrape, 3 extract, 4 batch, 7 answer, 2 crawl, 3 map, 2 media, 2 summarize, 3 research, 1 act, 1 monitor, 1 parse.
Source: [the peer run from Oct. 22, 2026 at 17:42 UTC](../bench/results/peers-2026-10-22T17-42-50-204Z.json).
<!-- bench:end -->

Each run of each task makes one row per tool. The table counts each tool's rows by status: `ok` means it answered and was graded, `error` means the call failed, `unsupported` means the tool cannot do that job, `skipped` means it was not run, most often for lack of a key, and `unrecorded` means no saved answer exists to replay.

<!-- bench:start status -->
| tool | ok | error | unsupported | skipped | unrecorded |
| --- | --- | --- | --- | --- | --- |
| webular | 117 | 0 | 0 | 0 | 0 |
| exa | 20 | 0 | 54 | 43 | 0 |
| jina | 0 | 0 | 96 | 0 | 21 |
| contextdev | 0 | 0 | 0 | 117 | 0 |
| perplexity | 0 | 0 | 87 | 0 | 30 |
| openai-web-search | 0 | 0 | 0 | 117 | 0 |
| zyte | 0 | 0 | 0 | 117 | 0 |
| bing-grounding | 0 | 0 | 0 | 117 | 0 |
| valyu | 0 | 0 | 0 | 117 | 0 |
| gemini | 0 | 0 | 96 | 0 | 21 |
| apify | 0 | 0 | 0 | 117 | 0 |
| scrapegraph | 0 | 0 | 0 | 234 | 0 |
| firecrawl | 20 | 0 | 60 | 37 | 0 |
| serpapi | 0 | 0 | 0 | 117 | 0 |
| curl-html2text | 0 | 0 | 0 | 117 | 0 |
| browserbase | 0 | 0 | 96 | 0 | 21 |
| tinyfish | 0 | 0 | 0 | 117 | 0 |
| vertex-grounding | 0 | 0 | 0 | 117 | 0 |
| searxng | 0 | 0 | 0 | 117 | 0 |
| linkup | 0 | 0 | 0 | 117 | 0 |
| nimble | 0 | 0 | 0 | 117 | 0 |
| youcom | 0 | 0 | 105 | 0 | 12 |
| serper | 0 | 0 | 0 | 117 | 0 |
| crawl4ai | 0 | 0 | 0 | 117 | 0 |
| tavily | 0 | 0 | 63 | 0 | 54 |
| readability | 9 | 0 | 99 | 0 | 9 |
| parallel | 0 | 0 | 84 | 0 | 33 |
| brightdata | 0 | 0 | 0 | 117 | 0 |
| spider | 0 | 0 | 0 | 117 | 0 |
| trafilatura | 0 | 0 | 0 | 117 | 0 |
| anthropic-web | 0 | 0 | 0 | 117 | 0 |
<!-- bench:end -->

- A tool with no `ok` rows has no score. A missing score is never a zero. A tool with no key is skipped. The test program, called the harness, reads keys from the environment or the macOS Keychain, and the text report names the missing key.

## Scores per job

Each score keeps only rows with status `ok`. It averages each task over its runs, then takes the mean across tasks. The tasks column says how many tasks the score rests on; a score from 1 task is one answer, right or wrong.

<!-- bench:start jobs -->
| job | tool | tasks | mean accuracy |
| --- | --- | --- | --- |
| act | webular | 1 | 0.000 |
| answer | exa | 7 | 1.000 |
| answer | webular | 7 | 1.000 |
| batch | exa | 3 | 1.000 |
| batch | firecrawl | 3 | 1.000 |
| batch | webular | 4 | 1.000 |
| crawl | firecrawl | 1 | 0.000 |
| crawl | webular | 2 | 0.500 |
| extract | firecrawl | 3 | 1.000 |
| extract | webular | 3 | 1.000 |
| map | firecrawl | 3 | 0.333 |
| map | webular | 3 | 0.667 |
| media | firecrawl | 1 | 1.000 |
| media | webular | 2 | 1.000 |
| monitor | webular | 1 | 0.333 |
| parse | firecrawl | 1 | 1.000 |
| parse | webular | 1 | 1.000 |
| research | exa | 3 | 1.000 |
| research | webular | 3 | 1.000 |
| scrape | exa | 2 | 1.000 |
| scrape | firecrawl | 3 | 0.667 |
| scrape | readability | 3 | 0.333 |
| scrape | webular | 6 | 1.000 |
| search | exa | 4 | 1.000 |
| search | firecrawl | 4 | 1.000 |
| search | webular | 4 | 1.000 |
| summarize | exa | 1 | 0.000 |
| summarize | webular | 2 | 0.500 |
<!-- bench:end -->

## Shared tasks

A fair head-to-head uses only the tasks both tools answered, called shared tasks. Each rival, or peer, is compared with webular only on those. [The per-peer comparison](benchmarks-peers.md) holds that table and what it says.

## Agent matrix

Here an AI model, called the agent, gets a question and one tool, and must decide to call the tool and then answer. Each tool choice is an arm. This tests how well each tool works in an agent's hands. These numbers come from a separate agent run, linked below, not from the peer run above. "Jev on" means webular uses Jev for its judgment calls, such as which result to trust; "Jev off" means it uses its built-in rules instead.

<!-- bench:start matrix -->
Each line is one agent model, and each entry is one tool arm, from [the agent run from Oct. 22, 2026 at 06:24 UTC](../bench/results/models-2026-10-22-062400-merged.json). Every cell uses the same tasks, grader, seed, and prompt; only the tool changes. A cell says skipped when its key or its agent adapter is missing. A no tool call run is one where the model never called the arm's tool, so no graded answer came back. Sure-but-wrong counts graded wrong answers that came back with no timeout or error, as if the model were sure of them. The first number is the share of runs graded right, from 0 (none) to 1 (all). p50 is the median wait per run in ms (thousandths of a second). Tool calls is the average per run. Tokens (units of text the model read and wrote) and USD (the model bill) are totals over the cell's runs. A higher first number is better; a lower p50, fewer tokens, and fewer USD are better. Each cell is at most 4 runs, one per task, a small sample, so treat a difference of one run as noise.

- **claude-opus-5-5:** webular-jev-off 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 49101 ms, 1.0 tool calls, 819 tokens, 0.1010 USD); webular-jev-on 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 27641 ms, 1.0 tool calls, 751 tokens, 0.0893 USD); exa 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 24420 ms, 0.8 tool calls, 1024 tokens, 0.1045 USD); firecrawl 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 51562 ms, 0.8 tool calls, 958 tokens, 0.1445 USD); parallel skipped: no agent adapter; tavily 0.500 (4 runs, 2 no tool call, 0 sure-but-wrong, p50 39633 ms, 0.5 tool calls, 1282 tokens, 0.1233 USD); perplexity 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 34326 ms, 1.0 tool calls, 1141 tokens, 0.1040 USD); youcom skipped: no agent adapter; jina skipped: no agent adapter; linkup skipped: no agent adapter; valyu skipped: no agent adapter; serpapi skipped: no agent adapter; serper skipped: no agent adapter; gemini skipped: no agent adapter; apify skipped: no agent adapter; brightdata skipped: no agent adapter; browserbase skipped: no agent adapter; scrapegraph skipped: no agent adapter; nimble skipped: no agent adapter; tinyfish skipped: no agent adapter; contextdev skipped: no agent adapter; searxng skipped: no agent adapter; crawl4ai skipped: no agent adapter; trafilatura skipped: no agent adapter; readability skipped: no agent adapter. With Jev on: Webular is even with the best rival, perplexity.
- **claude-sonnet-5-5:** webular-jev-off 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 32596 ms, 1.0 tool calls, 822 tokens, 0.0410 USD); webular-jev-on 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 40484 ms, 0.8 tool calls, 766 tokens, 0.0356 USD); exa 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 33371 ms, 1.0 tool calls, 715 tokens, 0.0463 USD); firecrawl 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 39117 ms, 0.8 tool calls, 803 tokens, 0.0691 USD); parallel skipped: no agent adapter; tavily 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 26130 ms, 0.8 tool calls, 697 tokens, 0.0604 USD); perplexity 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 22034 ms, 1.0 tool calls, 781 tokens, 0.0461 USD); youcom skipped: no agent adapter; jina skipped: no agent adapter; linkup skipped: no agent adapter; valyu skipped: no agent adapter; serpapi skipped: no agent adapter; serper skipped: no agent adapter; gemini skipped: no agent adapter; apify skipped: no agent adapter; brightdata skipped: no agent adapter; browserbase skipped: no agent adapter; scrapegraph skipped: no agent adapter; nimble skipped: no agent adapter; tinyfish skipped: no agent adapter; contextdev skipped: no agent adapter; searxng skipped: no agent adapter; crawl4ai skipped: no agent adapter; trafilatura skipped: no agent adapter; readability skipped: no agent adapter. With Jev on: Webular is behind the best rival, exa.
- **claude-haiku-5-5:** webular-jev-off 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 52016 ms, 1.8 tool calls, 1885 tokens, 0.0067 USD); webular-jev-on 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 65475 ms, 2.0 tool calls, 2009 tokens, 0.0057 USD); exa 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 27840 ms, 1.0 tool calls, 782 tokens, 0.0052 USD); firecrawl 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 29754 ms, 1.0 tool calls, 908 tokens, 0.0062 USD); parallel skipped: no agent adapter; tavily 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 20386 ms, 0.8 tool calls, 1007 tokens, 0.0043 USD); perplexity 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 20782 ms, 1.0 tool calls, 830 tokens, 0.0027 USD); youcom skipped: no agent adapter; jina skipped: no agent adapter; linkup skipped: no agent adapter; valyu skipped: no agent adapter; serpapi skipped: no agent adapter; serper skipped: no agent adapter; gemini skipped: no agent adapter; apify skipped: no agent adapter; brightdata skipped: no agent adapter; browserbase skipped: no agent adapter; scrapegraph skipped: no agent adapter; nimble skipped: no agent adapter; tinyfish skipped: no agent adapter; contextdev skipped: no agent adapter; searxng skipped: no agent adapter; crawl4ai skipped: no agent adapter; trafilatura skipped: no agent adapter; readability skipped: no agent adapter. With Jev on: Webular is even with the best rival, exa.
<!-- bench:end -->

## Method, reruns, and outside scores

[How the benchmarks are run](benchmarks-method.md) gives the full method, the commands to run the test again, the raw data rules, and scores that other groups publish.

## Harness biases

A bias is a flaw in the test that can tilt results toward one tool. The audit in [bench/spec/spec-audit-fixes.md](../bench/spec/spec-audit-fixes.md) lists 16 biases. The fixes for several of them are in commit `2cc33fb9` on the branch `bench-harness-fairness`. These results do not include that commit.
<!-- bench:start fields -->
The results file has these top-level fields: `runs`, `seed`, `records`.
<!-- bench:end -->
So treat all 16 biases as open for these results:

1. The answer job compares unlike things: some tools return a short answer and others a list of results.
2. Warm and cold calls are mixed. A cold call is the first, with nothing saved yet; a warm call reuses saved work and is often faster.
3. Webular state carries across runs, so a later run can reuse what an earlier one saved.
4. Tasks were written from webular's misses and tuned on the same set, so webular has seen the test before.
5. Cost and ties are scored in webular's favor.
6. No confidence intervals, the ranges that show how sure a score is; repeats of one task are treated as separate evidence.
7. Search tasks test homepage lookup, an easy kind of search.
8. Settings and result counts are not equal across tools.
9. One process, one machine, and unlogged load: other work on the machine could have slowed any tool.
10. Timeout, retry, and error handling differ across tools.
11. ABBA order (running A, B, B, A so a slow start or end favors neither) covers webular code variants only, not the rivals.
12. The grader, the code that checks answers, has false passes and false fails.
13. Replay keys ignore the code version, so a saved answer can outlive the code that made it, and call budgets drop rows.
14. Metric definitions are not comparable across tools.
15. Gold answers, the known right answers, carry no source or date.
16. Webular-only fixture tasks, built from saved test pages, sit next to a self-comparison table.
