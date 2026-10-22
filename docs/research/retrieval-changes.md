# Retrieval changes for webular

The ranked list below draws on 569 distinct arXiv papers (2025 to 2026), merged in `retrieval.jsonl`. Of these, 42 were read in full and 527 from the abstract only. Each paper has one row with its verdict: `apply`, `already-done`, or `not-applicable`.

Changes are ranked by expected gain per unit of work. Changes that need no model call come first. A change that touches a Jev decision is marked "needs decision-models-first receipt".

Every proof uses a dev set of labeled queries. Run the code with the change and without it on the same queries, then compare the metric. Keep a change only if the metric holds or rises on a held-out half of the set.

Most papers measured other models and other tasks. Treat each paper's number as a lead to test on webular, not as a result.

## 1. Query-aware freshness in `src/lib/sources/rank.ts`

- **File:** [`src/lib/sources/rank.ts`](../../src/lib/sources/rank.ts).
- **Change:** Pick the half-life from a query class instead of the fixed 365 days. A keyword lookup sets the class: "latest", "today", "price", and "now" get a short half-life; history and reference queries get a long one.
  - Add a date-window gate. A regex turns "in 2024", "before 2019", or "since March" into an interval, and hits outside it score zero.
  - Lower the score of hits with no date or a doubtful date.
  - Boost or penalize hits by cues such as "supersedes", "replaced by", and "deprecated".
- **Papers:** 2603.16544, 2609.00548, 2509.01306, 2605.13052, 2609.23880, 2610.23598, 2606.06044, 2609.31342, 2604.14227, 2510.08109.
- **Metric:** stale-answer rate and precision@1 on time-sensitive and dated queries.
- **Proof:** Collect 60 or more queries across fresh, dated, and timeless classes, each with a known correct URL. Compare the position of that URL with and without the change. Timeless queries must not drop.
- **Model call:** none. Only ambiguous queries could go to Jev; that part needs decision-models-first receipt.

## 2. Weighted rank fusion with a smaller constant

- **File:** [`src/lib/local-index.ts`](../../src/lib/local-index.ts) (`fuseRanked`) and [`src/lib/search.ts`](../../src/lib/search.ts).
- **Change:** Give each result list a weight (local index, web engine, each free source). Try a k near 20 in place of 60. Fuse the full lists, not a fixed top-L slice, and stop early only when the unread ranks cannot change the top K.
- **Papers:** 2609.22770, 2610.24341, 2608.02112, 2608.07152, 2609.15143.
- **Metric:** nDCG@10 and hit@k of the merged list.
- **Proof:** Grid-search the weights and k on the first half of the dev set. Report nDCG@10 on the second half. Equal-weight k=60 is the baseline.
- **Model call:** none.

## 3. Reword the query only when the first result is weak

- **File:** [`src/lib/search-hop.ts`](../../src/lib/search-hop.ts) (the `WEAK_SCORE` gate) and [`src/lib/search-chain.ts`](../../src/lib/search-chain.ts).
- **Change:** Always keep the original query as one fused list. Add entity or reworded variants as extra lists, never as replacements, and run them only when the top-1 score is under the gate.
  - Split a multi-constraint question into short clues. Search each clue, and add terms from that clue's own first-pass hits. Cap the rounds at two or three.
  - Detect "A vs B" with a regex and search each entity at the same time.
- **Papers:** 2609.05637, 2603.13301, 2606.28367, 2609.14412, 2606.13905, 2601.21654, 2508.09303, 2605.13534, 2508.19113, 2610.20122, 2608.15851.
- **Metric:** hit@10 and answer accuracy on multi-constraint questions, with lower latency on easy ones.
- **Proof:** Split the dev set into easy and hard queries and report both. The gate must leave easy queries unchanged.
- **Model call:** none if the clue split and term expansion use regex and code. A model-based clue split is a Jev decision and needs decision-models-first receipt.

## 4. Gate the Jev rerank per query

- **File:** [`src/lib/search-chain.ts`](../../src/lib/search-chain.ts).
- **Change:** Skip the Jev rerank when cheap features say it will not help: a wide score margin between the top hits, strong overlap between source lists, or a confident BM25 top hit. Skip extra web engines in the same case.
- **Papers:** 2609.22880 (full read), 2505.18512, 2605.25092, 2603.02153.
- **Metric:** Jev calls per query and latency at equal nDCG@10.
- **Proof:** Log every skipped query. Compare its final top-1 with the reranked top-1 on the dev set. Accept a loss of at most 1 point.
- **Model call:** it removes calls. The rerank is a Jev decision, so any change to it needs decision-models-first receipt.

## 5. One Jev choice question over the top candidates

- **File:** [`src/lib/search-chain.ts`](../../src/lib/search-chain.ts), after rank fusion.
- **Change:** Ask Jev one choice question over the top 16 hits (one probability per hit) in place of one question per hit.
  - Shuffle the candidate order and average two orders.
  - Subtract Jev's answer on an empty candidate, weighted by entropy.
  - Keep dates, trust, and reasoning text out of the prompt. Keep recency in `rank.ts`.
- **Papers:** 2610.28435 (full read), 2610.23346, 2609.40241, 2606.01782, 2604.10150, 2509.11353, 2608.03091, 2510.08985, 2609.26251.
- **Metric:** hit@1 and nDCG@10 of the final list.
- **Proof:** Compare per-hit yes/no, one choice question, and the debiased version on the dev set.
- **Needs decision-models-first receipt.**

## 6. Turn agent queries into questions, and rank by passage

- **File:** [`src/lib/search-chain.ts`](../../src/lib/search-chain.ts) and [`src/lib/local-chunks.ts`](../../src/lib/local-chunks.ts).
- **Change:** Turn agent keyword queries into plain questions before ranking. Rank passages under a small context budget. In the paper, BM25 on passages beat dense retrievers on agent-style quoted queries.
- **Papers:** 2602.21456 (full read).
- **Metric:** recall@k and answer accuracy on agent-style queries.
- **Proof:** Take 40 or more quoted, keyword-style queries from real agent use. Compare page-level and passage-level ranking.
- **Needs decision-models-first receipt** if a model writes the question.

## 7. Domain trust tiers and fit to the question's field

- **File:** [`src/lib/sources/rank.ts`](../../src/lib/sources/rank.ts).
- **Change:** Add a static trust table with tiers (government, education, rank-listed, low-credibility list).
  - Combine trust with freshness as the smaller of the two, not their product.
  - Add an intent-by-source-type table: medical and legal questions need official or research sources, and code questions prefer forums.
  - Enforce the table in code, because a trusted-domain list in a prompt barely changes citations.
- **Papers:** 2603.25092, 2604.20856, 2607.22584, 2609.23354, 2605.28565, 2602.16942, 2607.05217.
- **Metric:** the share of top-5 sources that suit the question's field, and source-ranking P@5.
- **Proof:** Label the source type for 100 or more dev queries. Count unsuitable sources in the top 5 with and without the table.
- **Model call:** none.

## 8. Drop dead and invented URLs

- **File:** [`src/lib/search.ts`](../../src/lib/search.ts).
- **Change:** Check every returned URL with a HEAD request, with GET as the fallback. Treat 404 as dead. Ignore 403, which is usually bot blocking.
- **Papers:** 2604.03173, 2509.04499, 2509.00761.
- **Metric:** citation-URL validity rate.
- **Proof:** Run 200 dev queries and count dead URLs in the top 10 with and without the check.
- **Model call:** none.

## 9. Open the top page for freshness-sensitive queries

- **File:** [`src/lib/search-chain.ts`](../../src/lib/search-chain.ts).
- **Change:** For queries in a fresh class, fetch the top hit's body and cite its date before answering.
- **Papers:** 2610.21731, 2509.11353, 2602.13543, 2511.01409.
- **Metric:** stale-answer rate and citation faithfulness. The paper reports 6.4% stale with snippets against 1.3% with opened pages.
- **Proof:** Run the fresh dev queries both ways and compare the answer's date to the ground truth.
- **Model call:** none.

## 10. Diversity only when near-copies crowd the top results

- **File:** [`src/lib/search.ts`](../../src/lib/search.ts) and [`src/lib/fingerprints.ts`](../../src/lib/fingerprints.ts). MMR exists only in [`src/lib/summarize-rank.ts`](../../src/lib/summarize-rank.ts).
- **Change:** Count distinct hosts or SimHash clusters in the top k. When there are fewer than the query needs, apply MMR or a one-result-per-host cap. Leave clean lists alone. Drop repeated paragraphs (navigation, cookie text) in `fingerprints.ts`, keeping the first copy.
- **Papers:** 2610.09412 (full read), 2604.13728, 2601.17212, 2510.22681, 2608.03089.
- **Metric:** evidence coverage at no loss of hit@k.
- **Proof:** Build queries where the top 10 holds copies. Check that coverage rises there and hit@k stays flat on clean lists.
- **Model call:** none. A per-query MMR weight set by a model is a Jev decision and needs decision-models-first receipt.

## 11. Cheaper entity and official-site resolution

- **File:** [`src/lib/source-subject.ts`](../../src/lib/source-subject.ts), [`src/lib/sources/official-sites.ts`](../../src/lib/sources/official-sites.ts), [`src/lib/sources/wikidata-facts.ts`](../../src/lib/sources/wikidata-facts.ts).
- **Change:** Accept the top Wikidata candidate outright when the label match is exact or the gap to the second is wide. Ask Jev only on the hard tail, and let it abstain. For official sites:
  - Fall back to other properties when P856 is missing.
  - Ignore claim words such as "official" inside a domain name.
  - Use direct P31 only, and dedupe by item id.
- **Papers:** 2510.20098, 2603.01486, 2601.08500, 2608.25037, 2609.29130, 2609.39786, 2511.04926, 2604.02618, 2609.00228, 2609.10745.
- **Metric:** entity-subject accuracy and official-site hit rate, with fewer Jev calls.
- **Proof:** Use 100 or more navigational queries with a known official URL.
- **Needs decision-models-first receipt** for the Jev gate.

## 12. Regex query types and a top-two intent set

- **File:** [`src/lib/search-intent.ts`](../../src/lib/search-intent.ts) and [`src/lib/jev/decisions/search-intent.ts`](../../src/lib/jev/decisions/search-intent.ts).
- **Change:** Add regex types to the keyword baseline: quoted phrase, how-to, comparison, definition, date expression. When Jev is under the confidence bar, query the union of sources for the top two intents.
- **Papers:** 2604.02431, 2603.01486, 2505.14524.
- **Metric:** source-routing accuracy and hit@10 on cold-start queries.
- **Proof:** Label the right sources for 100 queries and score routing with and without the change.
- **Needs decision-models-first receipt** for the top-two output.

## 13. Rank sources by observed quality and latency

- **File:** [`src/lib/search-source-run.ts`](../../src/lib/search-source-run.ts).
- **Change:** Score each source as `hit_rate / (1 + latency_ema / 1500 ms)` using a moving average. A fast source with no hits must not outrank a slow source with good hits.
- **Papers:** 2605.14241, 2506.13743.
- **Metric:** p95 latency and hit@10 when sources are slow or failing.
- **Proof:** Replay a recorded run with injected delays and compare.
- **Model call:** none.

## 14. Clean the evaluation set so 1.000 means something

- **File:** the eval harness.
- **Change:** Block benchmark-hosting domains during eval runs. Drop results that quote the question text. Score a no-search baseline and discard queries it already answers. Use one fixed, criteria-based judge prompt with graded 0 to 3 labels, a quoted-passage reason, and a second pass on low-confidence labels. Report significance, not only a mean.
- **Papers:** 2606.05241, 2508.13180, 2605.28721, 2603.04751, 2507.09488, 2609.09703, 2505.19334, 2501.14296, 2609.35739.
- **Metric:** stable nDCG@k and MRR, with leaked queries removed.
- **Proof:** Run the same dev set twice and check that the metrics match. Count removed queries.
- **Needs decision-models-first receipt** for the judge prompt.

## Already in the code

Several papers confirm choices webular has made.

- `rank.ts` scores trust times recency.
- `search-chain.ts` fuses lists with RRF and an official-domain signal.
- `simhash.ts` and `fingerprints.ts` hold a 64-bit SimHash and a 4-block lookup, which 2607.08382 supports.
- `as-of.ts` pins `WEBULAR_AS_OF`.

## Gaps in this research

- Reader 2 hit rate limits, so fusion, learned sparse, and score normalization have thinner coverage.
- Many row dates come from the arXiv id month, so the order is exact only to the month.
- Most rows are abstract reads, so their takeaways carry less weight than the 42 full reads.
- No paper covered URL canonicalization.
