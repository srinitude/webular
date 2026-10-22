# Fairness, anti-cheating, guard tests, and the report

This file holds the rules that keep the benchmark honest, the tests that enforce them, and the shape of the report.
It builds on [benchmark-spec.md](benchmark-spec.md), [spec-grading-and-stats.md](spec-grading-and-stats.md), and spec-model-tracks.md.
The fixes for each finding of the bias audit are mapped in [spec-audit-fixes.md](spec-audit-fixes.md).

## Freeze before running

- Each set version is frozen before any tool runs on it: task files, gold answers, graders, judge prompt, judge model id, and the list of tests with their alpha.
  The freeze is a commit plus a `manifest.json` that holds the sha256 of every file.
  Shipping code, data, and version together is a BetterBench practice ([BetterBench](https://arxiv.org/abs/2411.12990)), and naming the tests and power before the run follows [Card et al.](https://arxiv.org/abs/2010.06595) and [Anthropic's eval statistics post](https://www.anthropic.com/research/statistical-approach-to-model-evals).
- Gold answers and graders do not change after a run starts.
  A gold fix makes a new set version, and every tool is re-graded from its recordings.
- A report may compare only results from the same set version.

## Contamination and leakage

- **Private split.** 30% of each family is held out, stored encrypted outside the public repo, and run only by the harness owner.
  Both public and private scores are reported, and a gap over 10 points flags overfitting.
  The HLE leaderboard keeps a held-out split for the same reason ([HLE leaderboard](https://scale.com/leaderboard/humanitys_last_exam)).
- **Target list stays private.** Peers learn the method but not the private task list, so no one can tune for it ([Proxyway](https://proxyway.com/research/web-scraping-api-report-2025)).
- **Fresh tasks.** Every month, the `*.fresh` families get tasks whose answers appear on the web only after the build date, as in LiveBench ([LiveBench](https://arxiv.org/abs/2406.19314)) and FreshQA ([FreshQA](https://arxiv.org/abs/2310.03214)).
  Fresh tasks carry their build date and move to the public split after 90 days.
- **Canary.** Every task file, README, and code copy carries one canary GUID, so leaks can be found ([BIG-bench canary post](https://www.lesswrong.com/posts/kSmHMoaLKGcGgyWzs/big-bench-canary-contamination-in-gpt-4)).
- **No gold on the web path.** An answer that cites a page hosting the benchmark itself (GitHub, Hugging Face, Kaggle, or the paper) is graded wrong.
  Anthropic saw a model find and decrypt BrowseComp answers this way ([Anthropic, eval awareness](https://www.anthropic.com/engineering/eval-awareness-browsecomp)), and HAL found agents looking up benchmarks in its logs ([HAL](https://arxiv.org/abs/2510.11977)).
- **Webular is not tuned on the private split.** Webular code and prompts never read private task files, and a guard test checks this.

## Fair treatment of peers

- Each peer runs through its official API at documented defaults in the default track, and at equal budgets in the tuned track (see [spec-grading-and-stats.md](spec-grading-and-stats.md)).
- Each peer adapter is short and checked against the vendor's docs.
  Any setting that differs from the vendor default is written in the adapter with a reason.
- A job a peer does not offer is marked `not offered`, never scored as zero.
- Vendor-run benchmarks supply tasks only, never results.
  Exa, Parallel, Tavily, and Linkup each rank first on their own tests (the vendor list is in spec-alternatives.md).
  Two independent boards rank Perplexity and Brave in opposite orders ([AIMultiple](https://aimultiple.com/agentic-search); [OpenBenchmarks](https://openbenchmarks.com/web-search)).
- Peers and webular get byte-identical inputs, in a random task order per round, with the same timeouts.

## Caching rules

- Every round gets a round id and a cache dir, `rounds/<round-id>/cache`.
  `WEBULAR_CACHE_DIR` points there, and the dir is deleted after the round's recordings are saved.
- Headline latency comes from cold runs with `WEBULAR_NO_CACHE=1`, and with each peer's no-cache option where one exists.
- Server-side cache hits are detected and labeled as described in [spec-grading-and-stats.md](spec-grading-and-stats.md).
  Cache-hit rate is measured apart from other results ([Artificial Analysis](https://artificialanalysis.ai/methodology/performance-benchmarking)).
- Replay mode reads recordings only and never calls the network.

## Guard tests

The builder writes one test per rule, and each test fails the build when its rule breaks.

### Set, cache, and run rules

1. **Manifest hash.** The hashes in `manifest.json` match the task, gold, grader, and judge files.
2. **Frozen set.** A run refuses to start when the task files differ from the frozen set version.
3. **Quotas met.** Every family meets its task count and every diversity quota in [benchmark-spec.md](benchmark-spec.md), including at most 10% navigational search tasks.
4. **Every task has a grader.** Each task has a deterministic check or a pinned judge rubric, and no check is empty.
5. **Gold is verifiable.** Every gold answer stores its source URL, as-of date, aliases, author, and question type, and every gold URL resolved on its build date.
6. **No private leak.** Webular's source tree and prompts hold no private task text and no canary string, and no test-set miss list is written where tuning can read it.
7. **Per-round cache.** Each round's cache dir did not exist before the round, no tool reads another round's dir, and the dir is gone after the round.
8. **No localhost in output.** The run fails if any `localhost` or `127.0.0.1` URL appears in any tool's output.
9. **Cold means cold.** Rows labeled cold used a cache-busting query and had no local or flagged server-side cache hit.
10. **Interleaved order.** The run log shows every provider interleaved per task in a random order, ABBA for each timed pair, one process per provider, and load logged per row.
11. **Same inputs and limits.** Each tool got the same input bytes per task, the same result count after cutting, the same timeout, retry policy, and budget.
12. **Both settings run.** Each peer ran at default and best-documented settings, with every request body saved.
13. **Replay keys.** Recordings are keyed by commit, settings hash, and date, and replay equals the live-graded score.
14. **Same row set.** Every provider in a comparison has the same task set and run window, and no row is skipped or unrecorded.
15. **Secrets stay out.** Recordings and reports hold no API key, token, or cookie, checked with a secret scanner.
16. **robots.txt honored.** Webular never fetches a disallowed path in any task.
    A task whose gold says `"status":"blocked","reason":"robots"` passes only when two things hold: the run's output ended with status `blocked` and reason `robots`, and the recorded requests show no GET of a disallowed path.
    Peers that fetch the page anyway are scored in the robots compliance column of the report, not in accuracy.

### Scoring and report rules

17. **Full cost count.** Webular's cost, bytes, and keys include every outbound call: Jev, search engines, and fetches.
18. **Prices dated.** Every cost row names its price source URL and the date it was read.
19. **Split answer job.** Retrieval, fixed-reader, native-answer, and closed-book results are scored and reported apart.
20. **Judge calibration.** The judge's kappa is at least 0.8 on the calibration set before any judged score is published.
21. **Judge blinding.** Judge inputs carry no tool names, answer order is swapped, and length is capped.
22. **Stats present.** Every comparison shows n, the paired difference, its task-level bootstrap 95% CI, the test name, and the Holm-adjusted p.
23. **No overclaiming.** Report text says "win" or "loss" only where that rule holds, and "tie" otherwise; no "dimension winner" appears.
24. **Error rows kept.** Empty, partial, timeout, and error rows have their own status, count as failures, and enter latency as censored.
25. **Not offered is not zero.** A job a peer does not offer is marked `not offered`, and webular-only fixtures stay out of headlines.

### Model-track rules

26. **Three models ran.** Every agent-track arm ran with `claude-opus-5-5`, `claude-sonnet-5-5`, and `claude-haiku-5-5`.
27. **One web tool per arm.** Each arm allowed only its own tool, and `WebSearch` and `WebFetch` were off.
28. **Same arm conditions.** Task text, turn budget, timeout, and grader are byte-identical across arms, and wrapper descriptions differ in length by at most 10%.
29. **Run records complete.** Each agent run records tool calls, turns, tokens, wall time, pass or fail, and cost per correct answer.
30. **Grader cross-check.** Every rubric has Cohen's kappa per Claude model against gold and Fleiss' kappa across the three, and no Claude grader sets a headline score.
31. **Human audit.** A stratified human sample of at least 5% of rows per provider and family was re-graded, with agreement reported.

## Report format

Each round writes `report.json` for machines and `report.md` for people.
`report.md` has these parts, in this order:

1. **Header.** Set version, round id, date, harness commit, judge model id, runner region, and each tool with its version and settings hash.
2. **Results per family.** One table per family, with one row per tool.
   Columns: n, score with 95% CI, paired difference against webular with CI, Holm-adjusted p, verdict (win, loss, tie, not enough tasks, not offered), error rate, cost per correct answer, and robots compliance (rule 16, never part of the score).
3. **Answer job split.** Retrieval, fixed-reader, native-answer, and closed-book scores side by side, with `memory` tasks counted.
4. **Latency.** p50, p90, and p99, cold and warm apart, per tool and job, at concurrency 1, 4, and 16, with cached rows counted.
5. **Cost and accuracy.** A Pareto plot per job, with each price source and its date ([Kapoor et al.](https://arxiv.org/abs/2407.01502)).
6. **Agent track.** For each model and arm: pass rate with CI, pass^k, tool calls, turns, tokens, wall time, and cost per correct answer.
7. **Grader track.** Cohen's kappa per model against gold, Fleiss' kappa across models, the self-preference gap, and human-audit agreement.
8. **Slices.** Scores split by every diversity axis: domain, language, freshness, popularity, page type, query type, and premise type ([CRAG](https://arxiv.org/abs/2406.04744)).
9. **Public against private.** Both scores per family, with any gap over 10 points flagged.
10. **Errors.** Counts per error kind per tool, with three sample rows each.
11. **Capability section.** Fixture and job results that some peers cannot run, kept out of the headline.
12. **Vendor claims.** Each vendor's own number next to the harness number, with the claim's URL and date.
13. **Changes.** What changed in the set, harness, or adapters since the last round, with commit links.

The repo's core report builds the 11 parts above that need no model track, in the same order.
Parts 6 and 7 come from the model tracks.

`report.json` holds every row: task id, tool, model, arm, run, status, score, latency, cache flag, cost, load, and recording hash.
