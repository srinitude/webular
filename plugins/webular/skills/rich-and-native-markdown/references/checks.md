# File checks and evidence limits

| Section | Use when | Do not use when | Related |
| --- | --- | --- | --- |
| [Checker and how to run it](#checker-and-how-to-run-it) | Before you accept any Markdown file or set of files | You only want to judge writing quality | [Manual duties](#manual-duties) |
| [Manual duties](#manual-duties) | A tool cannot decide the item | The checker already settled it | [Checker and how to run it](#checker-and-how-to-run-it) |
| [Links and headings](#links-and-headings) | A file has local links, anchors, or odd renderer syntax | The file has no links and no headings | [Reading cycles](#reading-cycles) |
| [Reading cycles](#reading-cycles) | A file set has required reads between files | The output is a single file with no reading edges | [Manual duties](#manual-duties) |
| [Evidence limits](#evidence-limits) | You must judge the strength of a readability claim | You need an operating rule, not evidence | [Links and headings](#links-and-headings) |

- Use this file to check webular Markdown: scraped page text turned to Markdown, research reports, README files, skill files, and prompts.
- It needs no other file first. It holds the checker duties, the manual duties, and the evidence limits.

## Checker and how to run it

- The checker is one TypeScript file, `scripts/check.ts`. It takes the Markdown files as arguments.
- It never judges clear writing, kept meaning, true reading needs, or support in every Markdown app.

### Run it

- From the plugin folder `plugins/webular`, run `bun skills/rich-and-native-markdown/scripts/check.ts <files...>`.
- Pass every Markdown file in the output set. Add `--manifest <file.json>` to check a declared reading graph.
- It prints JSON and exits with code 1 when it finds an error.
- If the checker cannot run, report that check as not run, never as passed.

### What it checks

- File size: a 150-line review point and a 199-line cap.
- Local links and anchors, with heading IDs in the GitHub style. External URLs are not fetched.
- The reading graph from a manifest: required-read cycles, and reachability from the entry files.
- It does not check the heading outline or paragraphs. Those are manual duties.

### How to read the result

- Treat any error it reports as a failure.
- Finish every item it flags for review before you accept the result.
- A clean result is not a complete language or dependency audit.

## Manual duties

- The checker cannot find unlisted prose rules. Read the sources and do these items yourself.

### Reading edges

- Classify each reading edge as `required` or `navigation-only`, and give every edge a plain reason.
- `required` means the target must be read to understand or follow the source. A prose instruction with no link counts as required.
- `navigation-only` means an optional route that supplies no needed context. A label never proves the choice.
- Follow required edges that leave the set to the end of the chain.
- List the entry file. Every file in the set must be reachable from it.

### Line reasons

- Give a true, reviewed core-content reason for any file of 150 to 199 lines.
- A reason that only exists is not enough. State why the remaining text is core and why a split would break it.

### Headings and paragraphs

- Check the heading outline by hand: one title, no skipped levels, and content under each heading.
- Record each justified standalone paragraph with its file, line, exact text, and a specific reason.
- Record an empty list when no standalone prose is justified.
- A record never proves its reason sound.
- Raw HTML goes to manual review. Never hide rules in HTML or another excluded form to dodge a check.

## Links and headings

- Local relative links must point to files that exist. Directories must exist; no index page is guessed.
- A fragment must match a heading ID in the GitHub style. That style is a convention, not proof of support in every app.
- External URLs are not fetched. Check them another way when they matter.
- Wiki links, footnotes, attributes, directives, shortcodes, and includes need the real renderer.
- Literal blocks, quotes, tables, and metadata are not prose faults, but they still need meaning and language review.

## Reading cycles

- A self link, or a direct or indirect required cycle, fails.
- Navigation-only edges are skipped only because the reviewer marked them so.
- A clean visible part never proves the full graph.
- Never call checker results a complete language or dependency audit.

## Evidence limits

- This section holds evidence, not operating rules. Check each source's date and the target's behavior before you rely on it for a claim about the target.

### Standards and guides

- The rare-paragraph, grade 6 English, and line rules are project rules. The WCAG AAA reading-level criterion does not make grade 6 universal.
- Publisher style guides, such as the Cloudflare and Google accessibility guides, are advice, not standards.
- CommonMark is the core baseline, not a conformance audit.
- GFM pipe tables hold one header row and inline cell content only, so check complex tables separately.
- GitHub alerts, footnotes, comments, and other host features have target-specific rules.
- Mermaid titles and descriptions can reach the rendered SVG. That does not prove understanding.
- WAI evaluation guidance says automated tools alone cannot determine accessibility.

### Context retrieval and repetition

- Vendor context-engineering guidance reports removing repeated instructions without loss, with detail loaded at the point of need. This argues against a universal repetition rule.
- Shortened history can discard details needed later. Stored records allow a focused return to earlier context, but storage alone does not mean the text is loaded.
- A prompt repetition experiment (arXiv 2512.14982) found that repetition helped many tested cases, was mostly neutral in another setting, and lost once. Long requests cost more time. It did not test file-loading workflows or rule authority.
- These findings support testing reminders and restoring missing context.
- They do not support rereading every file on a timer or assuming repetition always helps.
