# Research ledger

This folder holds the papers behind webular's design choices. Each row says whether a paper's idea applies to webular, and where. Use it to find the evidence for a rule or a code change, and to check whether an idea was already weighed.

## What is here

- [`papers.jsonl`](papers.jsonl): one row per paper, sorted by arXiv id. Each row has `arxiv`, `date`, `title`, `takeaway`, `applies_to`, `verdict`, `read`, and `topic`. Some rows also have a finer `subtopic`.
- [`agents-md-sources.jsonl`](agents-md-sources.jsonl): the sources for how AGENTS.md files are written and loaded, with links and notes.
- [`verdict-changes.jsonl`](verdict-changes.jsonl): each verdict the full-text pass changed, with `verdict_original`, `verdict`, and the evidence.
- One ranked change list per topic, listed under [Topics](#topics).
- [`open-items.md`](open-items.md): each ranked change not in the code, with its next step. [Research status](../research.md) gives the applied, rejected, and open totals.

## Counts

The ledger holds **4,394** distinct papers. Duplicate arXiv ids are dropped. When a paper was read more than once, a full-text read wins over an abstract read, and an abstract read wins over a title screen.

How each paper was handled (`read`):

- `full`: 1,077 read in full text.
- `abstract`: 3,209 read from the abstract only.
- `title`: 108 screened by title only. These count as screened, not read.

So 4,286 papers were read, and 108 more were screened.

Verdicts (`verdict`):

- `apply`: 1,307. The paper points to a change webular should make.
- `already-done`: 395. Webular already does what the paper suggests.
- `not-applicable`: 2,605. The paper does not fit webular.
- `unreviewed`: 87. Title screens with no verdict yet.

The full-text pass changed 219 verdicts: 218 went from `apply` to `not-applicable`, and 1 went from `apply` to `already-done`. The list is in [`verdict-changes.jsonl`](verdict-changes.jsonl). Paper 2601.06899 was withdrawn by its author, so its row has `"withdrawn": true`. Don't cite it.

Paper dates run from 2024-02-17 to 2026-10-22.

## Topics

Each change list draws on that topic's `apply` rows and names the arXiv ids behind each change.

- **Agents** (631 papers): tools, plans, and loops for coding and research agents. Changes: [agents-changes.md](agents-changes.md).
- **AGENTS.md** (48 papers): how to write the instruction files agents load. These share the agents change list: [agents-changes.md](agents-changes.md).
- **Answer quality** (702 papers): grading, citations, and abstaining. Changes: [answer-quality-changes.md](answer-quality-changes.md).
- **Decision models** (444 papers): Jev payloads, prompts, and confidence. Changes: [decision-models-changes.md](decision-models-changes.md).
- **Engineering** (1,047 papers): code quality, tests, speed, and resource use. Changes: [engineering-changes.md](engineering-changes.md).
- **Extraction** (430 papers): pulling clean content and facts from pages. Changes: [extraction-changes.md](extraction-changes.md).
- **Retrieval** (492 papers): search, ranking, and source choice. Changes: [retrieval-changes.md](retrieval-changes.md).
- **Other** (600 papers): a top-up pass across narrow themes such as routing, calibration, and MCP security. The theme is in `subtopic`. These rows have no change list of their own; their `apply` rows name the files they touch.

## How to use it

- To find papers for a file, search `applies_to` in [`papers.jsonl`](papers.jsonl) for the file's path.
- Treat an abstract-only row as a lead to test, not a proven result.
- Keep a change only after a before-and-after check shows it helps.
