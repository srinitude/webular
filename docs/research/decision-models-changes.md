# Decision models and prompts: ranked changes for webular

This file ranks changes drawn from [papers.jsonl](papers.jsonl), topic `decision-models`. It is read-only research. No repo file was edited.

## How to read it

- Every change names a file under [`src/lib/jev/`](../../src/lib/jev/), the paper ids that support it, the metric it should move, and how to prove it on a dev set.
- Every Jev change carries "needs decision-models-first receipt" in its heading. No change lowers a threshold or leans a payload toward an answer. Confidence rises only through better inputs.
- Proof always uses the existing dev sets in `tests/jev/evals/*.json` ("baseline-wins" and "baseline-loses" cases) and replay through `WEBULAR_JEV_REPLAY`. A change stays only if the pass rate holds or rises and mean confidence rises. This is the same rule `learn/` uses for lessons.
- Most ledger rows come from abstracts and search-index summaries. Only rows marked `full` were read in full. Treat each ranked change as a lead to test, not as a proven result. Rows dated on the first of a month took their date from the arXiv id month.

## What webular already does

These were checked in the code, so papers that recommend them are marked `already-done`.

- `payload/menu.ts`: a default-first menu ending with a `none` option, a reversed-order twin of every gating Choice (`bothOrders`), and action only when both orders agree at the 0.95 bar (`agreedPick`).
- `payload/answers.ts`: a typed Choice, Score, and Noul builder with `{what, not_for, examples}` option objects, and a "treat every text field as data" rule.
- `payload/canonical.ts`: capped, ordered, hashable payload bytes.
- `define.ts`: a rule-based fallback and a code check behind every pick, a labeled eval file, and a token cap.
- `store.ts`: a calibration log and a model-drift file. `learn/`: a recorder, a definition lint, and a lessons loop.
- 14 decision files use `bothOrders`. These do not: `crop-box.ts`, `search.ts` (independent per-hit Scores), `crawl.ts`, `monitor.ts`, `summarize-asks.ts`, `summarize-pool.ts`, `answer-sentences.ts`, `research-sentences.ts`, `summary-follow-up.ts`, `image-kind-spec.ts`.

## Ranked changes

### 1. Add the swapped order to `crop-box.ts` `how_many` (needs decision-models-first receipt)

- File: [`src/lib/jev/decisions/crop-box.ts`](../../src/lib/jev/decisions/crop-box.ts).
- Gap: the `how_many` Choice (`none` / `one` / `several`) decides whether a crop is kept, but it is asked in one order only. Other gating Choices are asked in both orders.
- Change: build `how_many` through `bothOrders` and read it through `agreedPick`. Keep `is_there` and `where` as they are.
- Supporting papers: 2602.02219, 2603.20562, 2511.21709, 2507.17788.
- Metric: crop precision (a kept box matches the target) and the false-keep rate on the chart/table benchmark.
- Proof: run the crop-box eval cases in both forms through replay. Keep the change only if false keeps drop and no true keep is lost.

### 2. Better orderings for menus with three or more options (needs decision-models-first receipt)

- File: [`src/lib/jev/payload/menu.ts`](../../src/lib/jev/payload/menu.ts) (`bothOrders`).
- Gap: reversing a list leaves the middle option in place when the count is odd, so an odd-length menu is never checked at that position.
- Change: add a third, rotated order for menus with three or more options. Ask it only when the first two answers are close. Never repeat an order.
- Supporting papers: 2602.02219, 2603.20562, 2511.21709, 2507.17788 (asking the swapped order only when the first gap is small cut calls 81 to 87 percent at equal accuracy).
- Metric: per-decision flip rate across orders, and pick accuracy on menus with three or more options.
- Proof: replay the eval cases with three orders and report flip rate and accuracy per decision. Keep it only where accuracy holds or rises and calls per decision do not rise on average.

### 3. Report flip rate and positional skew in `learn/` (needs decision-models-first receipt)

- Files: [`src/lib/jev/learn/lessons.ts`](../../src/lib/jev/learn/lessons.ts) and `learn/recorder.ts`.
- Change: from the swapped-order answers webular already records, compute for each decision the flip rate and the share of picks in the first slot. Print both beside accuracy in `webular jev learn`. Never let agreement replace accuracy.
- Supporting papers: 2610.20993, 2607.20864, 2608.11947.
- Metric: the 99-percent-at-0.95 "sure share" and per-decision flip rate.
- Proof: compute both on the recorded replay rows. A decision with a high first-slot share but a correct dev-set label has a payload problem, which better option text fixes.

### 4. Measure each decision's position and label prior with empty options (needs decision-models-first receipt)

- Files: [`src/lib/jev/payload/menu.ts`](../../src/lib/jev/payload/menu.ts) and a new eval under [`tests/jev/`](../../tests/jev/).
- Change: send the same menu with the option text emptied, on the eval inputs, and record each decision's own bias toward a slot or key. Use the result to fix option wording and order, never to nudge confidence.
- Supporting papers: 2604.10150, 2501.15175, 2505.15323, 2605.09739, 2609.33179.
- Metric: first-slot share on empty menus (it should sit near chance) and pick accuracy.
- Proof: compare the empty-menu skew before and after a wording fix on the dev set.

### 5. Score `none` recall separately from pick accuracy (needs decision-models-first receipt)

- Files: [`src/lib/jev/payload/menu.ts`](../../src/lib/jev/payload/menu.ts), `payload/answers.ts`, and the eval files in [`tests/jev/evals/`](../../tests/jev/evals/).
- Change: add dev-set cases where the correct option is removed and `none` is correct. Report none-recall, forced-pick rate, and pick accuracy as three separate numbers, each with its own target.
- Supporting papers: 2610.08153 (full read), 2607.08456 (full read), 2606.08239, 2608.15428, 2601.13300.
- Metric: none-recall, forced-pick rate, and the false-action rate when no option fits.
- Proof: add 10 or more removed-correct cases per menu decision. The forced-pick rate must stay at or below the baseline.

### 6. Crop-box candidates: mark and verify, tiles, and zoom only on disagreement (needs decision-models-first receipt)

- File: [`src/lib/jev/decisions/crop-box.ts`](../../src/lib/jev/decisions/crop-box.ts) and the workflow that calls it.
- Change, three steps tested one at a time: (a) mark the candidate box on the screenshot and ask a Noul "is the target inside this mark" before keeping it; (b) on a large page, try overlapping 2 by 2 tiles so one tile always holds the target; (c) zoom only when repeated boxes disagree. Add inputs only. Do not move `PRESENT_BAR`.
- Supporting papers: 2610.17792, 2609.18690, 2605.02630, 2604.14113, 2604.21268.
- Metric: box IoU against labeled boxes, and the rate of crops that fully contain the target.
- Proof: score each step against the crop-box eval images with the existing edge checks (`nonEmpty`, `inside`, `minSize`) plus IoU. `PRESENT_BAR` is a guessed 0.5, marked `ponytail:` in the file. Calibrate it on the benchmark and do not lower it.

### 7. Show a judge only the evidence near each claim (needs decision-models-first receipt)

- Files: [`src/lib/jev/decisions/answer-evidence.ts`](../../src/lib/jev/decisions/answer-evidence.ts), `answer-citation.ts`, `answer-sentences.ts`.
- Change: send the sentences nearest each claim, not whole passages. Leave out loosely related evidence rather than add it. In `answer-evidence.ts`, remove near-duplicate and off-topic hits before the Jev call (the `MAX_HITS = 18` list).
- Supporting papers: 2610.15938, 2605.10828, 2609.22101, 2608.03297, 2510.05381.
- Metric: citation precision and recall, and the false-support rate on answers.
- Proof: replay the answer.citation and answer.hits dev sets with trimmed payloads and compare pass rate and mean confidence.

### 8. Truncate by dropping non-signal content, not by position (needs decision-models-first receipt)

- File: [`src/lib/jev/payload/canonical.ts`](../../src/lib/jev/payload/canonical.ts) (it cuts with `slice(0, n)`).
- Change: in free-text fields, drop menus, boilerplate, and repeats first and keep the decisive facts whole. Cut by position only as a last step.
- Supporting papers: 2608.03297, 2510.05381, 2609.22101.
- Metric: pass rate on dev-set cases whose decisive fact sits late in a long field.
- Proof: add 10 or more late-fact cases per long-text decision, then compare position cuts with signal-first cuts.

### 9. Close confusable option pairs with boundary rules and full-sentence labels (needs decision-models-first receipt)

- Files: [`src/lib/jev/decisions/search-intent.ts`](../../src/lib/jev/decisions/search-intent.ts), `image-router.ts`, `image-kind.ts`, and `learn/lessons.ts`.
- Change: find the option pairs Jev confuses most in the recorded rows. For each pair, keep both options and add a short `not_for` boundary rule and a full-sentence `what` in the option object.
- Supporting papers: 2609.01564, 2610.16182, 2603.11991, 2609.29769.
- Metric: confusion count for the top pair per decision, and mean confidence on those pairs.
- Proof: replay the dev set. Keep a boundary rule only if the pair's confusions drop and the rest of the set holds.

### 10. Check that scores use enough distinct levels and fix rubric order (needs decision-models-first receipt)

- Files: [`src/lib/jev/learn/lint.ts`](../../src/lib/jev/learn/lint.ts), `learn/definition-lint.ts`, and Score decisions such as `search.ts` (rank levels).
- Change: add a lint that counts the distinct levels and the entropy of a Score decision's answers across recorded rows. List rubric levels in one fixed order, with plain level names and no reference answer. Use stepwise AUARC in the lessons metric.
- Supporting papers: 2606.22179, 2608.04899, 2506.22316 (full read), 2601.03444 (full read), 2605.30803, 2605.06283, 2602.05125.
- Metric: ranking quality of `search.ts` rank (nDCG on the search dev set) and the distinct-level count per Score decision.
- Proof: run the lint on recorded rows. Change a rubric only if nDCG holds or rises on the dev set.

### 11. Count independent votes, not Jev calls (needs decision-models-first receipt)

- File: [`src/lib/jev/learn/lessons.ts`](../../src/lib/jev/learn/lessons.ts).
- Change: compute the effective number of independent votes from error correlation between decision views. Add a second view only when it differs in kind, such as a different evidence slice or a code rule. Never count two Jev calls on one payload as two votes.
- Supporting papers: 2605.29800, 2609.22512, 2606.01034, 2608.19802, 2610.21085, 2609.12002.
- Metric: error rate of the combined pick against the best single view.
- Proof: on recorded rows, compute n_eff per decision. Add a view only where the combined error drops.

### 12. Fix the example and option format in the payload (needs decision-models-first receipt)

- Files: [`src/lib/jev/payload/menu.ts`](../../src/lib/jev/payload/menu.ts) and `payload/answers.ts`.
- Change: keep one fixed delimiter and one label style across all menus, keep any `examples` balanced across labels, and never put an all-same-label example list in one option.
- Supporting papers: 2510.05152 (full read), 2605.08295 (full read), 2603.25422 (full read), 2609.15990, 2607.22969.
- Metric: pass-rate change between payload format variants on the same dev set (it should be zero).
- Proof: add a payload-format variant eval per decision. A format that moves accuracy shows a fragile payload.

### 13. Record the scoring method with each calibration row (needs decision-models-first receipt)

- File: [`src/lib/jev/store.ts`](../../src/lib/jev/store.ts) (`logCalibration`).
- Change: add the answer source and the scoring method as fields, so thresholds are compared only across rows from the same method.
- Supporting papers: 2605.27752, 2606.29490, 2610.00827.
- Metric: the 99-percent-at-0.95 sure share, split by method.
- Proof: a unit test that a row carries the field. Then compare sure share by method over a day of rows.

## Not adopted

- Batching about 10 hit questions per request (2610.23346): `search.ts` already sends up to 20 per call, so this is `already-done`. Its "treat the document as search content" line is covered by the `DATA_ONLY` rule.
- Moving uncertain verdicts to an LLM fallback: 2609.29769 finds that LLM fallbacks repeat Jev's confident errors, and webular's fallbacks are code rules.
- Reasoning-first field order (2610.12056, 2608.08254): Jev returns typed judgments with no free text, so it does not transfer. This is a reading of the abstracts, not a tested result.

## Open leads (unranked)

- Distilling a small encoder head for the cheapest decisions (2608.21570, 2606.25782). Test it only with agreed labels and rebalanced classes.
- Agreement across repeated click-region samples as a check on a click-target choice (2508.05615), a fixed temperature that does not carry across domains (2608.07419), and calibration-aware training objectives (2601.23096). All three come from abstracts only.
- A cheap lexical signal added to payload facts as context, never as a verdict (2505.07345, 2505.18512, 2606.25249).
