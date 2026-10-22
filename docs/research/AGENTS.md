# docs/research/AGENTS.md

The paper ledger and the change lists drawn from it. The parent [AGENTS.md](../AGENTS.md) holds the docs rules.

## What lives here

- [`README.md`](README.md): the counts, the topics, and links to each change list.
- [`papers.jsonl`](papers.jsonl): one row per paper, keyed by arXiv id.
- [`agents-md-sources.jsonl`](agents-md-sources.jsonl): the sources for how AGENTS.md files are written.
- [`verdict-changes.jsonl`](verdict-changes.jsonl): each verdict the full-text pass changed.
- [`open-items.md`](open-items.md): each ranked change not in the code, with its next step. The totals are in [`../research.md`](../research.md).
- Ranked changes from each topic's `apply` rows: [`agents-changes.md`](agents-changes.md), [`answer-quality-changes.md`](answer-quality-changes.md), [`decision-models-changes.md`](decision-models-changes.md), [`engineering-changes.md`](engineering-changes.md), [`extraction-changes.md`](extraction-changes.md), and [`retrieval-changes.md`](retrieval-changes.md).

## Rules

- Don't add a second row for an arXiv id. Strip the "arXiv:" prefix and any version suffix first. A full-text read replaces an abstract-only row.
- Don't pad the ledger. Every row is a paper someone read or screened, and title screens never count as reads.
- Don't cite an abstract-only row as proof. It is a lead until a check backs it.
- Don't cite a row marked `withdrawn`.
- Don't change [`papers.jsonl`](papers.jsonl) without updating the counts in [`README.md`](README.md).
