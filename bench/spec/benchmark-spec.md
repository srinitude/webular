# Webular web-research benchmark spec

This spec says how to build and run a fair benchmark that compares webular with every tool that does the same jobs.
Webular's jobs are search, scrape, batch, map and crawl, answer (cited QA), research (multi-hop), and feed.
The goal is a score that is objective, hard to game, wide in coverage, and close to real use.
Another helper builds the benchmark, and this spec is what that helper must meet.

## Reading order

1. This file: the current bench, the task families, quotas, and where the gold answers come from.
2. [spec-grading-and-stats.md](spec-grading-and-stats.md): graders, statistics, win rules, latency, and cost.
3. spec-scrape-grading.md: scrape, PDF, and JavaScript grading.
4. spec-model-tracks.md: the agent track and the grader track, run with Opus, Sonnet, and Haiku.
5. [spec-integrity-and-report.md](spec-integrity-and-report.md): fairness, caching, guard tests, and the report.
6. [spec-audit-fixes.md](spec-audit-fixes.md): how each of the 16 findings in the bias audit of the current bench is fixed.
7. spec-alternatives.md: every alternative, with an adapter plan or a reason to leave it out.
8. [sources.md](sources.md): every source, with its URL and date.

The repo's report builds the 11 parts that need no model track; the agent-track and grader-track parts live with the models helper.

## What exists, and what this spec adds

The harness lives at `scripts/bench/peers/` in the benchmarks harness, with the plan in `benchmarks/benchmark-plan.json`.

- It has search 18, scrape 6, and answer 19 tasks, and none for batch, map and crawl, research, or feed.
- Its checks are `contains`, `excludes`, `regex`, and `urlMatches`, with text folded to lowercase ASCII.
- It times each call, runs 3 times, and reports p50, p95, p99, and cold start.
  It has no ABBA order across providers, so the builder must add it.
- It records responses by sha256 key and can replay them.
- Webular, Firecrawl, Exa, Tavily, and Perplexity have adapters, and Parallel is a stub.
- A bias audit found 16 faults in it, from mixed warm and cold latency to tasks tuned on webular's misses ([spec-audit-fixes.md](spec-audit-fixes.md)).

This spec keeps the checks, recordings, and replay.
It adds the missing jobs, an LLM judge with calibration, paired statistics, ABBA timing, cache rules, the model tracks, the audit fixes, and the full peer list.

## Task families

Each family has a name, a count per set version, and its grader (see [spec-grading-and-stats.md](spec-grading-and-stats.md)).
Counts include the 30% private split.

### Search (320 tasks)

- `search.known-item` (120): one or more right pages; graded by URL match, recall at 1, 3, and 10, and MRR.
- `search.fresh` (60): the right page appeared within 90 days of the build date.
- `search.reasoning` (60): the query needs reasoning to match the page, as in BRIGHT ([BRIGHT](https://arxiv.org/abs/2407.12883)); graded by nDCG@10.
- `search.long-tail` (40): entities with no Wikipedia page or under 1,000 monthly views.
- `search.multilingual` (40): queries in at least 8 languages, written by native speakers.

At most 10% of all search tasks are navigational ("official site") lookups.
The rest are informational, long-tail, recent, multi-intent, or non-English.

### Scrape and batch (150 scrape tasks, 20 batch jobs)

- `scrape.page` (150): page to Markdown across 12 page types, with at least 10 each.
  Types and graders are in spec-scrape-grading.md.
- `batch.urls` (20): 50 URLs each, including dead links, redirects, and blocked pages.
  It is graded on per-URL scrape scores, partial-failure reporting, and throughput.

### Map and crawl (30 sites)

- `crawl.map` (30): sites of three sizes (under 50, under 500, and under 5,000 pages), with and without a sitemap, and with scope limits.
  It is graded by URL-set precision, recall, and F1 against a frozen snapshot.

### Answer (330 tasks)

- `answer.short` (200): short factual answers.
- `answer.citation` (60): every claim must cite a URL that supports it.
- `answer.false-premise` (40): the question holds a false claim that the tool must reject ([FreshQA](https://arxiv.org/abs/2310.03214); [SealQA](https://arxiv.org/abs/2506.01062)).
- `answer.no-answer` (30): no answer exists on the web, and the right output says so.

Every answer task is scored in three modes, plus a baseline, so unlike outputs are never compared:

- `retrieve.evidence`: the provider's passages and sources, graded against gold evidence spans.
- `answer.fixed-reader`: one pinned answerer model reads each provider's passages, under the same token cap, and writes the answer.
- `answer.native`: the provider's own synthesized answer, for providers that offer one, reported apart.
- closed-book: the same answerer with no web tool; tasks it gets right are tagged `memory` and reported apart.

### Research (210 tasks)

- `research.multihop` (150): hard-to-find facts with short answers, as in BrowseComp and FRAMES ([BrowseComp](https://arxiv.org/abs/2504.12516); [FRAMES](https://arxiv.org/abs/2409.12941)).
- `research.wide` (30): find many entities and return records with source excerpts, as in WANDR ([WANDR](https://arxiv.org/abs/2608.14747)).
- `research.report` (30): a cited report graded by rubric and citation checks ([DeepResearch Bench](https://arxiv.org/abs/2506.11763)).

### Feed (30 feeds)

- `feed.items` (30): RSS, Atom, JSON Feed, and pages with no feed, graded by item-set precision, recall, and lag.

## Diversity quotas

Every family meets each quota that applies to it, and a guard test checks them.

- **Domain:** at least 8 domains (science, health, law, finance, software, sports, culture, local and government), and no domain over 20%.
  Accuracy drops on harder, less popular, and fast-changing questions, so these slices must be measured apart ([CRAG](https://arxiv.org/abs/2406.04744)).
- **Language:** at least 20% non-English in search, answer, and research, across at least 5 languages, including Chinese and Korean ([BrowseComp-ZH](https://arxiv.org/abs/2504.19314); [K-BrowseComp](https://arxiv.org/abs/2606.02404)).
- **Freshness:** at least 20% of answer and research tasks have answers that changed within 90 days of the build date ([FreshQA](https://arxiv.org/abs/2310.03214); [LiveSearchBench](https://arxiv.org/abs/2511.01409)).
- **Popularity:** at least 25% long-tail entities ([CRAG](https://arxiv.org/abs/2406.04744)).
- **Page type:** HTML, JavaScript-rendered, PDF, paywalled, `robots.txt`-blocked, and anti-bot pages, with counts in spec-scrape-grading.md.
- **Ambiguity:** at least 10% of answer tasks are ambiguous and ship a set of accepted answers.
- **Premise:** false-premise and no-answer tasks make up at least 20% of the answer family.

## Power and counts

- Before freezing, the plan sets the smallest gap worth finding ([Anthropic](https://www.anthropic.com/research/statistical-approach-to-model-evals); [Card et al.](https://arxiv.org/abs/2010.06595)).
- For a paired McNemar test at alpha 0.05 and 80% power, with discordance p_d and gap d: n = (1.96 × sqrt(p_d) + 0.84 × sqrt(p_d − d²))² / d².
  - With p_d = 0.2, 200 tasks find a 9-point gap, and 120 tasks find a 12-point gap.
  - Finding a 5-point gap needs about 620 tasks.
- So families under 120 tasks report scores and CIs, and they declare a win or loss only when the gap is large enough for their n.

## Where the gold answers come from

Tasks come from outside sources and are drawn before any webular run.
A public dev set is used for tuning, and a sealed test set is used only for scoring.
Every task stores its author, build date, source URL, as-of date, accepted aliases, and question type.
Each public set is used only under its license, and none is copied where its license forbids it.

- **SimpleQA Verified**: 1,000 prompts; paper CC BY 4.0; data license to be confirmed ([SimpleQA Verified](https://arxiv.org/abs/2509.07968)). Used for `answer.short`.
- **FreshQA** (Apache-2.0, refreshed through April 2026): `answer.false-premise` and the freshness slice ([FreshQA](https://arxiv.org/abs/2310.03214)).
- **SealQA** (Apache-2.0): answer tasks with conflicting evidence ([SealQA](https://arxiv.org/abs/2506.01062)).
- **FRAMES** (Apache-2.0): `research.multihop` ([FRAMES](https://arxiv.org/abs/2409.12941)).
- **BrowseComp**, near saturation (license to be confirmed), and **BrowseComp-Plus** (MIT), whose fixed corpus allows a retrieval-only track ([BrowseComp-Plus](https://arxiv.org/abs/2508.06600)).
- **BrowseComp-ZH** (MIT, academic use only): internal multilingual runs only ([BrowseComp-ZH](https://arxiv.org/abs/2504.19314)).
- **WebWalkerQA** (repo Apache-2.0; data license to be confirmed): site-traversal tasks for `crawl.map` and `research.multihop` ([WebWalkerQA](https://arxiv.org/abs/2501.07572)).
- **BRIGHT** (paper CC BY 4.0): `search.reasoning` ([BRIGHT](https://arxiv.org/abs/2407.12883)).
- **BEIR** (licenses per dataset): a retrieval sanity check ([BEIR](https://arxiv.org/abs/2104.08663)).
- **WANDR** (Apache-2.0): `research.wide` ([WANDR](https://arxiv.org/abs/2608.14747)).
- **DeepResearch Bench** (MIT or Apache-2.0, to be confirmed) and **LiveResearchBench** (Apache-2.0): `research.report` ([LiveResearchBench](https://arxiv.org/abs/2510.14240)).
- **WCXB** (CC-BY-4.0), **olmOCR-Bench** (code Apache-2.0), and **OmniDocBench** (research only): scrape and PDF, as in spec-scrape-grading.md.

Left out as seeds:

- **GAIA** is gated and may not be reshared, and it is saturated at 93.69% ([GAIA](https://arxiv.org/abs/2311.12983)).
- **HLE** tests expert reasoning more than web research, and an audit found answer-changing errors in 22 of 48 sampled questions ([HLE](https://arxiv.org/abs/2501.14249)).
- **WebArena, VisualWebArena, and WebArena Verified** test browser actions on hosted sites, which is not a webular job ([WebArena Verified](https://github.com/ServiceNow/webarena-verified)).
- **LiveBench** has no search task and no recognized license ([LiveBench](https://arxiv.org/abs/2406.19314)).

Public seeds carry a contamination risk, so every family with public seeds also gets fresh tasks, and both scores are reported.

## How fresh tasks are built

- **Sources:**
  - Wikidata snapshot diffs, with each answer checked by SPARQL ([LiveSearchBench](https://arxiv.org/abs/2511.01409)),
  - dated news ([LiveNewsBench](https://arxiv.org/abs/2602.13543)),
  - software releases, changed docs, and price pages.
- **Inverted writing for hard tasks:** start from a short, checkable answer, and write a question that needs several pages to reach it ([BrowseComp](https://arxiv.org/abs/2504.12516)).
- **Two-person check:** two writers must agree on the answer, each with a source ([SimpleQA](https://arxiv.org/abs/2411.04368)).
  The source URL, its saved snapshot, and the supporting span are stored with the gold.
- **Hardness filter:** drop a task that every tool answers right in a pilot, but keep 10% easy tasks as a floor.
  Seal-0 goes further and keeps only questions that frontier models fail ([SealQA](https://arxiv.org/abs/2506.01062)).
  The pilot runs on the dev set only, and no tool's misses decide which test tasks stay.
- **Expiry:** a fresh task carries its build date and moves to the public split after 90 days.
