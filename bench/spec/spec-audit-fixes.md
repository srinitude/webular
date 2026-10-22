# Fixes for the bench bias audit

This file maps each of the 16 findings in the bench bias audit to the spec rule that fixes it.
Rules that other spec files already hold are linked, not repeated.
It builds on [benchmark-spec.md](benchmark-spec.md).

## 1. The answer job compares unlike things (critical)

- Split answering into two families:
  - `retrieve.evidence`: each provider returns passages and sources, graded against gold evidence spans for recall and precision.
  - `answer.fixed-reader`: one pinned answerer model reads each provider's passages, capped at the same token budget, and writes the answer.
- Each peer's own written answers are scored in a third family, `answer.native`, which is reported apart.
- A closed-book baseline runs the same answerer with no web tool.
  A task that the closed-book run gets right is tagged `memory` and reported apart.
- Grading uses normalized exact match first, then the pinned judge (see [spec-grading-and-stats.md](spec-grading-and-stats.md)).
- Answer questions must need search: recent, long-tail, or multi-source.

## 2. Warm and cold calls are mixed (critical)

- Cold and warm are reported apart and never pooled; the pooled p50 is dropped ([spec-grading-and-stats.md](spec-grading-and-stats.md#latency-protocol)).
- Each cold call uses a cache-busting variant of its query (a paraphrase or a harmless extra term, checked to keep the same gold).
  Repeats of a task are spaced at least 30 minutes apart.
- A repeat-query cache probe runs per provider, and cache evidence from the API is saved.
- `coldStartMs` is the median of each provider's first call on the same fixed task, not one row.

## 3. Webular state carries across runs (high)

- Every run gets a fresh `WEBULAR_CACHE_DIR` and index, plus a recorded `WEBULAR_NO_CACHE` choice ([spec-integrity-and-report.md](spec-integrity-and-report.md#caching-rules)).
- Fixtures are served from a host that never enters the index.
- The run hard-fails if any `localhost` or `127.0.0.1` URL appears in any output.

## 4. Tasks were written from webular's misses and tuned on the same set (high)

- A frozen dev set and a sealed test set are drawn before any webular run, from outside sources ([benchmark-spec.md](benchmark-spec.md#where-the-gold-answers-come-from)).
- Every task stores its author, build date, source URL, as-of date, accepted aliases, and question type.
- Test-set misses are never printed or logged where the tuning loop can read them.
  Tuning uses the dev set only.
- The test set is re-drawn on a schedule, and fresh tasks come in every month.

## 5. Cost and ties are scored in webular's favor (high)

- Every outbound call webular makes counts toward bytes, dollars, and keys: Jev calls to `api.typesafe.ai`, search engines, and page fetches.
- Ties are reported as ties.
  No provider wins a tied or definitional metric, and the report names no "dimension winner".
- Peer cost uses billed usage where the API reports it, and the list price with its date otherwise.

## 6. No confidence intervals; repeats treated as independent (high)

- Intervals come from a task-level paired bootstrap, and repeats only estimate noise within a task ([spec-grading-and-stats.md](spec-grading-and-stats.md#statistics)).
- A power analysis sets each family's size before freezing ([benchmark-spec.md](benchmark-spec.md#power-and-counts)), with at least 100 tasks per job.

## 7. Search tasks test homepage lookup (high)

- At most 10% of search tasks may be navigational ("official site").
- The rest spread over informational, long-tail, recent, multi-intent, and non-English queries.
- Scoring uses graded relevance: nDCG@10, MRR, and recall at 1, 3, and 10, with several accepted URLs per task.

## 8. Settings and result counts are not equal (medium)

- Every provider gets the same result count N, enforced by cutting results after the call.
  Every provider also gets the same timeout, retry policy, and budget.
- A settings table lists each peer's default and best-documented settings.
  Both are run, and each request body is saved with its result.
- Firecrawl `maxAge` and similar caches are turned off for cold runs.

## 9. One process, one machine, unlogged load (medium)

- Each provider runs in its own process, in a randomized, interleaved order.
- Each row saves its start time, the load average, and process CPU.
- A round with load average above the core count is marked noisy and rerun.

## 10. Timeout, retry, and error handling differ (medium)

- One timeout and one retry policy, with backoff, apply to every provider, webular included.
- Empty, partial, and error rows each get their own status, and none counts as `ok`.
- Failures enter latency as censored at the timeout, and failure rates are reported per provider.

## 11. ABBA covers webular code variants only (medium)

- Providers run in a random order within each task, and blocks repeat across times of day.
- The latency analysis uses a mixed model with provider, task, and block effects.

## 12. Grader false passes and false fails (medium)

- Short answers use normalized exact match with alias lists and a word-boundary rule.
- Long answers use the pinned judge, which must find the answer stated as the answer.
- A stratified human audit of at least 5% of rows per provider and family runs every round, with agreement reported (spec-model-tracks.md).

## 13. Replay keys ignore the code version, and budgets drop rows (medium)

- Recordings are keyed by provider, task, run, commit, settings hash, and date.
- A comparison is refused unless every provider has the same task set and run window.
- A skipped or unrecorded row fails the round rather than leaving the denominator.

## 14. Metric definitions are not comparable (low)

- Each metric is defined per job over the same payload, and tokens count only that payload.
- Determinism is reported as a description, never scored as a win.
- Citation support is judged for every provider's cited passages.

## 15. Ground truths carry no source or date (low)

- Every task stores an authoritative source, an as-of date, accepted aliases, and a question type (see finding 4).
- A source-quality check flags citations to low-authority pages, and the report shows them.

## 16. Webular-only fixture tasks and a self-comparison table (low)

- Fixtures are hosted publicly so every provider can scrape them.
  A fixture that a peer cannot reach goes into a separate capability section, never into a headline.
- The webular-against-itself table is removed from the report.
