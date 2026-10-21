# Graders, statistics, latency, and cost

This file says how each answer is scored, how two tools are compared, and how speed and cost are measured.
It builds on the task families in [benchmark-spec.md](benchmark-spec.md).
Scrape grading has its own file, spec-scrape-grading.md.
Every source is listed in [sources.md](sources.md).

## Grading order

Each task is graded by the cheapest grader that can decide it, in this order:

1. **Deterministic checks.**
   These are URL match after normalizing (lowercase host; drop `www.`, tracking params, and fragments), exact or normalized string match, numeric match within a stated tolerance, and set overlap.
   They keep the existing `urlMatches` and `contains` checks.
2. **Reference-based LLM judge.**
   The judge only compares the answer with a gold answer, and it returns `correct`, `incorrect`, or `not_attempted`.
   This is the SimpleQA grading scheme ([SimpleQA](https://arxiv.org/abs/2411.04368)) and the BrowseComp judge pattern ([BrowseComp](https://arxiv.org/abs/2504.12516)).
3. **Rubric LLM judge.**
   It is used only for open research reports, with a fixed rubric per task, as in DeepResearch Bench RACE and FACT ([DeepResearch Bench](https://arxiv.org/abs/2506.11763)) and Mind2Web 2 Agent-as-a-Judge ([Mind2Web 2](https://arxiv.org/abs/2506.21506)).

## Grader per family

- `search.known-item` and `search.fresh`: URL match against a gold URL set, scored as recall@k and MRR at k = 1, 5, 10.
  Families with graded relevance add nDCG@10, the BEIR metric ([BEIR](https://arxiv.org/abs/2104.08663)).
- `search.reasoning`: nDCG@10 on BRIGHT-style qrels ([BRIGHT](https://arxiv.org/abs/2407.12883)).
- `scrape.*`: see spec-scrape-grading.md.
- `crawl.map`: URL-set precision, recall, and F1 against a frozen sitemap snapshot; pages outside the allowed scope count as errors.
- `answer.short`: the reference judge, reporting correct, incorrect, and not attempted.
  The headline is the SimpleQA F-score: the harmonic mean of overall correct and correct given attempted ([SimpleQA](https://arxiv.org/abs/2411.04368)).
- `answer.citation`: each cited URL must load and must hold a span that supports its claim.
  Citation precision and recall follow ALCE ([ALCE](https://arxiv.org/abs/2305.14627)).
- `answer.false-premise` and `answer.no-answer`: correct only when the tool rejects the premise or says it cannot answer, as in FreshQA ([FreshQA](https://arxiv.org/abs/2310.03214)) and SealQA ([SealQA](https://arxiv.org/abs/2506.01062)).
- `research.multihop`: the reference judge on the final short answer, as in BrowseComp and FRAMES ([FRAMES](https://arxiv.org/abs/2409.12941)).
- `research.report`: the rubric judge plus citation checks.
- `feed.*`: item-set precision and recall against a frozen feed snapshot, plus the gap in minutes between an item's publish time and the time the tool returns it.

## Judge rules

- The judge model is pinned by exact model id.
  It is never a model that a tool under test uses for its own answers, to avoid self-preference ([Panickssery et al.](https://arxiv.org/abs/2404.13076)).
- The judge sees answers with tool names removed, in a random order per task, to cut position and brand bias ([Zheng et al., MT-Bench](https://arxiv.org/abs/2306.05685)).
- Before use, the judge is calibrated on at least 200 human-labeled items.
  It ships only if Cohen's kappa against the human labels is at least 0.8 and its accuracy is at least 95%.
- A person relabels 5% of judged items every round, and a kappa below 0.8 blocks the report.
- Length earns nothing: the rubric scores facts, not words, and answers over the task's length cap are cut before judging.

## Statistics

- Every comparison is paired: the same tasks, the same round, every tool.
- Pass/fail outcomes use an exact McNemar test on the paired results.
  Confidence intervals come from a paired bootstrap with 10,000 resamples, clustered by task group when tasks share a source ([Miller, Adding error bars to evals](https://arxiv.org/abs/2411.00640)).
- Graded scores use a paired permutation test with 10,000 permutations.
- Each report names its family of tests ahead of time and controls family-wise error with Holm-Bonferroni at alpha 0.05.
- Power: before freezing, the plan sets the smallest gap that matters (default 5 points of accuracy) and computes the task count needed for 80% power.
  An underpowered comparison is labeled "not enough tasks" and is never called a win ([Card et al.](https://arxiv.org/abs/2010.06595)).
- Model-graded tasks run at least 3 times and report the mean and the spread across runs ([Miller](https://arxiv.org/abs/2411.00640)).

## Keep and win rules

- A **win** for webular over a peer on a family needs all three of these:
  - the Holm-adjusted p is below 0.05,
  - the 95% CI of the paired difference excludes zero,
  - webular's error rate is no more than 1 point worse than the peer's.
- A **loss** is the same test with webular and the peer swapped.
- A **tie** is any result that is neither a win nor a loss.
  The report says "tie", never "slightly better".
- A webular change is **kept** only if no family drops by a significant amount and the headline score holds or rises.
- The headline is never an average over families with different units.
  Each family reports its own number.

## Latency protocol

- **ABBA order.**
  Each pair of tools runs in A, B, B, A order per task, which cancels drift.
  The harness has no ABBA order, so the builder adds it.
  Runs repeat on different days and hours, as Artificial Analysis samples 8 times a day ([Artificial Analysis](https://artificialanalysis.ai/methodology/performance-benchmarking)).
- **Cold and warm.**
  Cold is the first request this round for a query the provider has not seen, with a per-round nonce where the API allows one.
  Warm is the same request repeated within 60 seconds.
  Both are reported, and they are never pooled.
- **Cache detection.**
  A server-side cache hit is flagged when a repeat returns byte-identical content at least 5 times faster than the cold call, or when the response says so (a cache header or a `maxAge` hit).
  Flagged rows are labeled `cached`, and the headline uses cold numbers only.
- **Local caches.**
  Every round writes to its own cache dir (`rounds/<round-id>/cache`).
  The harness fails if any tool reads a cache dir from another round.
- **Spread.** Report p50, p90, and p99 with bootstrap CIs. Means alone are not allowed.
- **Concurrency.** Measure at 1, 4, and 16 in-flight requests, with throughput and rate-limit errors at each level.
- **Placement.** Record the runner's region and each API's resolved region. Compare tools only from the same runner, in the same hour.
- **Timeouts.** The default is 60 s per call, and 300 s for research. A timeout counts as a failure, not a missing row.

## Cost protocol

- Cost per correct answer = list-price dollars spent / number of correct tasks, at each provider's public price on the run date.
- Every tool runs at its documented default settings.
  A second, tuned track gives each tool the same budget: the same max results, the same max pages, and the same dollar cap per task.
  This follows the cost-aware method of [Kapoor et al., AI Agents That Matter](https://arxiv.org/abs/2407.01502) and the [Holistic Agent Leaderboard](https://arxiv.org/abs/2510.11977).
- Every report includes a Pareto plot of accuracy against cost.

## Reproducibility

- Every raw response is recorded: the request, headers with secrets removed, status, body hash, and timing.
- Grading runs from recordings only, so a re-grade costs no API calls and gives the same score.
- Each round records the harness commit, set version, judge model id, and tool versions.

## Robustness and errors

- Every row ends in one of `ok`, `wrong`, `empty`, `error_4xx`, `error_5xx`, `timeout`, `blocked`, or `rate_limited`.
- Errors count as wrong in accuracy, and each error rate is also reported on its own.
- Robustness runs paraphrase 10% of queries and add typos to 5%; the report shows the accuracy drop for each.
