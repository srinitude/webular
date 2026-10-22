# Answer quality and evaluation: ranked changes for webular

Source ledger: [papers.jsonl](papers.jsonl), topic `answer-quality`. It holds 777 distinct arXiv papers: 39 read in full text and 738 read as abstracts only. Verdicts: 233 apply, 96 already-done, 448 not-applicable.

Limits that apply to every item:

- The `date` field has month precision only, taken from the arXiv id. The arXiv API returned HTTP 429, so exact days are missing.
- A paper's claim is checked against its full text only when the ledger row says `read: full`. Every other claim comes from an abstract, so read that paper in full before relying on it.
- No change was run. Each proof is a with-and-without run on the dev set (`bench/tasks/dev/*.jsonl`), never on the sealed test split.
- "Needs decision-models-first receipt" marks a change that touches a Jev decision.
- Paths are relative to the repo root.

## What webular already has

These are not repeated below.

- [`scripts/bench/stats.ts`](../../scripts/bench/stats.ts): seeded task-level paired bootstrap, exact McNemar, sign-flip test, Holm adjustment, power formula, and a minimum-gap rule.
- [`scripts/bench/judge.ts`](../../scripts/bench/judge.ts) and `agreement.ts`: the judge is off by default. It needs a 200-item calibration, kappa of at least 0.8, and accuracy of at least 0.95. Inputs are blinded and answer order is seeded. Cohen and Fleiss kappa are included.
- [`scripts/bench/leak.ts`](../../scripts/bench/leak.ts) and `claims.ts`: a canary string, a sealed split, a leak scan, and an overclaim guard.
- [`src/lib/summarize-rank.ts`](../../src/lib/summarize-rank.ts): extractive MMR with a lead prior and a section-lead prior. Every output sentence is a verbatim span with offsets.
- [`src/lib/jev/decisions/answer-citation.ts`](../../src/lib/jev/decisions/answer-citation.ts): a post-hoc claim-to-source verdict (supported, contradicted, or not_addressed), checked in both option orders and acted on at 0.95 confidence.

## Which summarize metric can honestly reach 1.000

- Verbatim fidelity can. Every summary sentence is an exact substring of the page at the stated offsets. This is true by construction, and a guard test makes it a measured 1.000.
- ROUGE-1 against one human reference cannot (measured at 0.1772). The summary is extractive and the reference is abstractive, so the ceiling is the extractive-oracle ROUGE-1. That ceiling is unmeasured and below 1.000. Reader 5 also found that ROUGE rankings flip with the reference set (2506.14335) and that ROUGE-1 and ROUGE-2 measure surface overlap (2609.22603, 2606.08000).
- The honest route to a 1.000 headline is oracle-normalized ROUGE-1: the score divided by the best extractive selection for the same page and length. Report raw ROUGE-1 beside it. A picker that matches the oracle scores 1.000. See change 4.

## Ranked changes

### 1. Harden alias and numeric grading

- File: [`scripts/bench/grade.ts`](../../scripts/bench/grade.ts) (`aliasMatch`, `numbersIn`, `runCheck`), and the alias lists in [`bench/tasks/dev/answer.jsonl`](../../bench/tasks/dev/answer.jsonl).
- Change:
  - (a) Set a numeric tolerance per question: integers up to 50 exact, mid-size numbers within 1%, numbers above 10,000 within 5%.
  - (b) Count a hedge that lists several candidates without committing as not attempted, not as a pass.
  - (c) Extract numbers by keyword anchor, skip step numbers and indices, and grade in a strict-then-lenient cascade.
  - (d) Grow gold alias lists by entity type: name forms, date formats, separators, units.
  - (e) Normalize scientific notation and Unicode in `numbersIn`.
- Papers: 2509.07968 (full), 2606.24839 (full), 2607.10240 (full), 2608.03397 (full), 2604.09497 (full), 2609.25009, 2402.11161.
- Metric: pass rate and false-pass rate of the answer family, scored as exact text against aliases. This one can honestly reach 1.000 on the dev set, because each fix removes a surface-form miss or a false pass and adds no model judgment.
- Proof: re-grade recorded dev outputs with and without each fix. Hand-audit every row whose verdict flips. Add adversarial rows that must fail, such as an enumeration that contains gold or a decline followed by a figure. Confirm zero added false passes.
- Jev: no. The alias growth in (d) stays deterministic. A judge or encoder fallback for misses (2604.09497) would be a decision step and needs the receipt.

### 2. Evidence-sufficiency and abstain gate before answering

- Files: [`src/workflows/answer.ts`](../../src/workflows/answer.ts) (between gather and synthesize), [`src/lib/jev/decisions/answer-evidence.ts`](../../src/lib/jev/decisions/answer-evidence.ts), and [`tests/models/agent/tasks.ts`](../../tests/models/agent/tasks.ts) (tool text).
- Change:
  - (a) Judge sufficiency before generation from three signals: question-part coverage, whether any passage offers an answer, and a small-model check.
  - (b) Use two separate checks with separate thresholds: "the question is answerable" and "my answer is likely right".
  - (c) When search finds nothing reliable, return an explicit "nothing reliable found, abstain" result instead of an empty list.
  - (d) Require at least two supporting passages before trusting a confidence score.
  - (e) Use a three-way gate: answerable, needs clarification, not answerable.
- Papers: 2609.37469 (full), 2610.05348 (full), 2607.08456 (full), 2605.03534, 2604.04565 (full), 2609.17516 (full), 2610.22615 (full), 2608.22228 (full).
- Metric: correct-abstain rate on the 13 `answer.no-answer` and 10 `answer.false-premise` dev rows, with exact match on `answer.short` rows held. It can reach 1.000 on the dev set if the gate separates the rows. The risk is false abstains, so report both rates.
- Proof: plot abstain recall against false-abstain rate on the dev answer rows. Sweep each threshold on a selection split and report on a held-out split.
- Jev: needs decision-models-first receipt for (a), (b), (d), and (e). Change (c) touches no Jev decision.

### 3. Tune the extractive picker on the dev set

- File: [`src/lib/summarize-rank.ts`](../../src/lib/summarize-rank.ts) (the lead prior `0.1 / (1 + i)`, `LAMBDA`, `NEAR_DUPLICATE`, and topN).
- Change: sweep the lead weight (0.1 up to about 1), `LAMBDA`, and the near-duplicate cutoff against dev ROUGE-1. Add a Lead-k baseline row to the report. Choose the sentence cutoff from a calibrated dev quantile. Optionally add graph-centrality masking and per-cluster isotonic calibration of the relevance score.
- Papers: 2512.08764 (full; Lead-1 reached ROUGE-1 0.247 against 0.164 for LexRank), 2509.20461 (full), 2505.22950 (full), 2604.17200 (full), 2609.08139 (full; mirroring the reference's lead phrase lifted ROUGE-1 from 0.247 to 0.395 in its setting).
- Metric: summarize ROUGE-1 (0.1772 as measured).
- Proof: fit on 70% of the dev tasks and report held-out ROUGE-1 with a bootstrap interval. Keep a change only if held-out ROUGE-1 holds or rises.
- Jev: no for the code-only sweep. If Jev scores sentence importance, that step needs the receipt.

### 4. Make the summarize metric honest and multi-reference

- Files: the summarize gold under [`scripts/bench/tasks/`](../../scripts/bench/tasks/) and [`bench/tasks/dev/`](../../bench/tasks/dev/), and [`scripts/bench/report.ts`](../../scripts/bench/report.ts).
- Change: score against several references (max or mean). Add the extractive-oracle ceiling per task. Report oracle-normalized ROUGE-1 beside raw ROUGE-1. Add an atomic-claim coverage score. Pin the ROUGE implementation and tokenizer. Add a guard that every output sentence is a verbatim substring at its stated offsets.
- Papers: 2506.14335, 2608.14457, 2606.08000, 2610.03825, 2609.22805, 2604.25130, 2603.28005, 2609.22603, 2607.10806, 2606.23989.
- Metric: summarize oracle-normalized ROUGE-1 and verbatim fidelity (the honest 1.000). Raw ROUGE-1 stays reported.
- Proof: rescore dev outputs against 1 reference versus 3 or more and check that the rank order holds. Check that the metric ranks a faithful paraphrase above a wrong summary.
- Jev: no for the multi-reference and oracle parts. If Jev grades claim coverage, that step needs the receipt.

### 5. Small-sample statistics

- Files: [`scripts/bench/stats.ts`](../../scripts/bench/stats.ts) and `report.ts`.
- Change: add Wilson or Beta-Bernoulli intervals for per-command pass rates and paired differences. The intervals must not collapse to zero width when every task passes. Add the resolution ratio q = N / N* and the minimum detectable gap to each comparison, and claim a gap only when q is at least 1. Report a repeated-split item bootstrap for any tuned configuration.
- Papers: 2503.01747 (full), 2605.30315 (full), 2605.05973 (full), 2510.08730.
- Metric: interval coverage and claim precision. No score changes. A 1.000 score still has a lower bound below 1.000 at small n, and the report must say so.
- Proof: simulate the coverage of the bootstrap and of the added intervals at the real per-command dev task counts.
- Jev: no. The tuned-artifact report needs the receipt only if the artifact is a Jev prompt or threshold.

### 6. Contamination controls for search-time leaks

- Files: [`scripts/bench/run.ts`](../../scripts/bench/run.ts), the search and scrape tool the bench uses, and [`scripts/bench/leak.ts`](../../scripts/bench/leak.ts).
- Change: block benchmark hosts (HuggingFace datasets, GitHub benchmark repos) during bench runs and log every blocked hit. Add a near-duplicate check of dev tasks against public sets. Add a blind baseline that answers without the web.
- Papers: 2606.05241 (full), 2508.13180, 2602.12413, 2511.04655.
- Metric: search, research, and answer pass rates free of leaked inflation. The gap between blocked and unblocked runs measures the leak.
- Proof: run the dev set with the blocklist on and off and report the paired difference.
- Jev: no.

### 7. Stronger citation verdict

- Files: [`src/lib/jev/decisions/answer-citation.ts`](../../src/lib/jev/decisions/answer-citation.ts), [`src/lib/jev/decisions/answer-sentences.ts`](../../src/lib/jev/decisions/answer-sentences.ts), and [`scripts/bench`](../../scripts/bench).
- Change:
  - (a) Rewrite each answer sentence as a standalone single-proposition claim before the verdict.
  - (b) Judge against the surrounding paragraph, not the sentence alone. The source is cut at 2,000 characters.
  - (c) Add a planted-text probe: append the answer words to a non-supporting passage and check that the verdict does not flip to supported.
  - (d) Verify against the original source spans, not the extracted text.
  - (e) Report false-positive and false-negative rates, not only F1.
  - (f) Check that cited URLs resolve before listing them.
- Papers: 2608.30145, 2604.01432, 2609.23053, 2609.14245, 2607.08700, 2604.03173, 2509.20859.
- Metric: citation-support accuracy and false-support rate on the 21 `answer.citation` dev rows.
- Proof: label about 100 (sentence, source) pairs. Compare verdict accuracy with and without each change. Compare planted pairs with clean pairs for the flip rate.
- Jev: needs decision-models-first receipt for (a), (b), (c), and (e). Changes (d) and (f) touch no Jev decision.

### 8. Judge reliability, only where a judge decides

- Files: [`scripts/bench/judge.ts`](../../scripts/bench/judge.ts) and `agreement.ts`.
- Change:
  - Use one pinned, calibrated judge per decision, not a panel. Panels added little information in 2605.29800.
  - Have the judge answer first, then compare.
  - Strip lead-in boilerplate ("master key" openers) from judge input.
  - Repeat each judgment in swapped order and report the flip rate.
  - Add bias-corrected pass rates from measured sensitivity and specificity.
  - Add a swapped-reference probe.
  - Escalate to the deterministic grader when the judge is unsure.
  - Keep gold and aliases in the judge prompt.
- Papers: 2605.29800 (full), 2607.05904, 2507.08794, 2606.13685, 2610.12083, 2511.21140 (full), 2601.07506 (full), 2609.26550 (full), 2609.02246 (full), 2610.08026 (full).
- Metric: judge kappa and accuracy against the existing gates (0.8 and 0.95), and judge-scored pass rates.
- Proof: calibrate on at least 200 labeled dev rows. Run each item several times and require a flip rate under 2%. Inject master-key openers and check that scores do not rise.
- Jev: needs decision-models-first receipt for every item here.

### 9. Penalty-aware scoring and canaries

- Files: [`scripts/bench/grade.ts`](../../scripts/bench/grade.ts), `report.ts`, [`bench/tasks/dev/answer.jsonl`](../../bench/tasks/dev/answer.jsonl), and [`tests/models/agent/tasks.ts`](../../tests/models/agent/tasks.ts).
- Change: report a score of correct minus k times wrong, with abstain at 0, beside accuracy. Add questions whose answers are absent from the corpus. Add withheld-context pairs where the answer must flip to abstain. Add canary tasks that no honest run can fully pass.
- Papers: 2608.26385, 2610.13821, 2610.07894, 2609.02246 (full).
- Metric: a guess-penalized score, and the over-answer rate on withheld pairs.
- Proof: re-grade existing runs and check that the ranking is stable across k. Check that an always-guess policy scores below a calibrated abstain policy.
- Jev: no.

### 10. Open the page, restate the question, check completeness

- Files: [`src/workflows/answer.ts`](../../src/workflows/answer.ts), [`src/commands/answer.ts`](../../src/commands/answer.ts), and [`src/commands/research.ts`](../../src/commands/research.ts).
- Change: answer from opened pages, not snippets. Restate the question after each opened page. Run a post-generation completeness check. Cross-check a direct claim against an independent source before it leads the output. Trim answer sentences to the minimal answering span. Optionally rerank sources by nugget coverage.
- Papers: 2610.21731 (full), 2609.35774, 2607.17291, 2509.20859, 2601.22008, 2504.15068, 2506.06539.
- Metric: answer pass rate, stale-answer rate (6.4% with snippets only versus 1.3% with an opened page in 2610.21731), and accuracy when a conflicting page is seeded.
- Proof: A/B on the dev answer and fresh splits. Seed one plausible conflicting page into research fixtures and measure how often the output adopts it.
- Jev: needs decision-models-first receipt for the cross-check, the completeness check, and the nugget rerank, because the Jev source-pick and sentence steps are touched. The open-page and restate steps are not Jev decisions.

## Order of work

1. Changes 1, 3, 4, 5, 6, and 9 are code and gold-file changes with no Jev decision. They can start in parallel.
2. Changes 2, 7, 8, and 10 touch Jev decisions. Each needs its decision-models-first receipt before any edit.
3. Change 4 comes before the ROUGE claims in change 3, so tuning targets the honest metric.
