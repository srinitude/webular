# Context, structure, disclosure, and readability

| Section | Use when | Do not use when | Related |
| --- | --- | --- | --- |
| [Context, coverage, and meaning](#context-coverage-and-meaning) | Starting any rewrite, or checking that nothing was lost | The task only asks for a format change of one short, fully read text | [Headings and hierarchy](#headings-and-hierarchy) |
| [Headings and hierarchy](#headings-and-hierarchy) | Choosing headings, lists, and levels | The output is JSON, code, or an exact fragment | [Content between headings](#content-between-headings) |
| [Content between headings](#content-between-headings) | Checking that each heading owns real content | The file is a single paragraph with no headings | [Headings and hierarchy](#headings-and-hierarchy) |
| [Links in the heading tree](#links-in-the-heading-tree) | Placing a link to more detail | There is no detail to move | [File size and splitting](#file-size-and-splitting) |
| [File size and splitting](#file-size-and-splitting) | A file nears 150 lines, or detail should move out | The file is short and has one purpose | [Links in the heading tree](#links-in-the-heading-tree) |
| [Reading order and cycles](#reading-order-and-cycles) | A set has several linked files | The set is one file | [File size and splitting](#file-size-and-splitting) |
| [Source and rendered readability](#source-and-rendered-readability) | Reviewing the source and the rendered page | You need a universal readability proof, which no check gives | [Reading order and cycles](#reading-order-and-cycles) |

- You need no other file in this package before this one.
- Webular Markdown includes scrape output, research reports, README files, skill files, and prompts. All of it follows these rules.

## Context, coverage, and meaning

### Load context

- A path, title, hash, or claim that a file was read is not its content. Fetch missing or cut-off parts before you claim full coverage.
- Time alone never makes text stale. Set no reread interval by minutes, turns, or file age.
- Reread only when the source changed, needed text is missing or only summarized, the task changed, exact wording is needed, a conflict or a seen mistake makes a rule unclear, or a rule demands a fresh read.
- When a key rule was missed, restate it once near the next action, with its source and scope. Reminders never become competing copies.
- A justified reread after a finished visit is a separate visit. A return to a file on the active reading path is a cycle and an error.
- The line cap does not limit total context. Never drop needed context to save space. Split the work into checked steps, or name the limit and stop that action. Between bounded review passes, keep the meaning ledger and the cross-file checks.

### Cover every rule, input, and output

- List the rules from the request, its sources, and this package. Record each as `rule | source | trigger | surfaces | action | check | result`. Mark a rule not applicable only with a specific reason. Uncertainty stays open.
- Cover every result the work creates, changes, or returns, in any format, including temporary, partial, child, and shared files.
- Markdown syntax, heading, list, and line rules apply to Markdown. Meaning, language, evidence, and review rules apply to all formats.
- Never put Markdown headings into JSON or code. If a rule and a format cannot both hold, report the conflict and withhold acceptance.
- List every input with its versions and which one governs. Keep empty, zero, false, and missing values distinct.
- Read each input in full. A summary or tool preview never stands in for unread content. Scraped page text counts as an input.
- Mark missing, cut-off, or unreadable parts, and stop the work that depends on them. An embedded link does not allow remote access or a wider task.
- Map every source item to its place in the output, or to a kept asset with a working reference.
- Never merge or dedupe distinct records, round, translate, convert units, or swap formulas for results unless asked.
- Compare the full input map with the full output set. Counts, hashes, and valid syntax prove nothing about meaning. A partial result names its missing coverage.

### Keep meaning and plain language

- Within meaning-preserving-rewrite's scope, map every requirement to its final wording and place, and keep the ledger current through edits and splits. Outside that scope, still compare source and output for lost meaning.
- Text surfaces include headings, labels, alt text, captions, table cells, metadata, examples, reports, and handoffs. No internal text is exempt.
- Limit any grade 6 exception to required exact or specialist text, and say why it stays.
- Use steady names for shared ideas. Fix "this", "above", or "below" when a split changes what they point to.
- Never make readers piece a rule together from scattered parts. Dense entries that pass the line cap still fail if they are hard to read.
- Never quietly fix a source contradiction by changing intent. Explain the conflict.

## Headings and hierarchy

- Headings and lists are the default form. Headings follow the source topic tree, not length or layout.

### Required levels

- Every file has exactly one H1 first, at least one H2, and at least one H3. Each linked file meets this on its own. An H2 may lack an H3 if another H2 has one.
- Never skip a level under the active parent: `H1 H2 H3 H4 H2 H3` passes, `H1 H2 H3 H2 H4` fails. Never go past H6.
- Use H4 to H6 wherever content has real nested sections at those depths. Never flatten them into bold labels or long bullets.
- Never add empty headings, filler, or extra levels to reach a count.
- If a tiny file, exact fragment, or required format cannot meet the minimum without breaking meaning, name the conflict and withhold acceptance of that file.

### Map the source topics first

- Read the whole input and needed context. Unread material cannot prove that no deeper content exists.
- Map each topic to its source passage, purpose, parent, and children. Check part-whole, general-specific, process-subprocess, and topic-subtopic links against the source. Nearness, indents, and repeated words prove nothing. Step order, prerequisites, and navigation are not nesting.
- Give a child a heading only when it has a distinct subject and a reading purpose in its parent. A lone condition or fact stays with its rule.
- Build H1 to H3, then check every H3 for H4 children, every H4 for H5, and every H5 for H6. Repeat after each added context, split, move, or edit.
- If a real hierarchy runs past H6, move that branch to a linked file with its own H1, H2, and H3. Never invent H7 or move core context to escape the limit. Report a conflict if no meaning-preserving split exists.
- If evidence cannot choose a parent, leave it unresolved and seek context or a user decision.

### Record the decisions

- Record each candidate's source locator, parent, role, form, destination, and reason. Record H4, H5, and H6 each as added, not needed (with evidence), or unresolved.
- Compare the topic map with the parsed and rendered outline, and account for titles the host adds. Recheck the tree, heading IDs, links, and anchors after any split, move, or heading edit.

## Content between headings

- Every heading owns real content before the next heading at any level or, for the last heading, before the end of the file.
- A parent's content comes before its first child heading.

### What counts as content

- Counts: a rule, scope statement, prerequisite, short explanation, step, or other needed block.
- Does not count: blank lines, comments, metadata, invisible anchors, empty items, thematic breaks, decoration, a sentence that repeats the heading, filler, invented facts, or a meaningless link.
- Parse with the target's rules, including Setext, HTML, and container headings. Inspect the rendered headings when you can.
- Check every space between headings, and the final one, for owned content that keeps the source meaning. Reject filler even when a parser accepts it. Recheck the whole set after each repair.

### Lists and paragraphs

- Ordered lists hold procedure steps. Make order, prerequisites, branches, and stop conditions explicit.
- Unordered lists hold all other rules, conditions, exceptions, prohibitions, and checks.
- One action per step and one rule per bullet where possible. Keep each condition and narrow exception with its rule.
- Nest lists only for real parent-child links: number child steps, and bullet child conditions.
- Keep an authored paragraph only when bullets would weaken a connected explanation. Record the file, passage, and reason.

## Links in the heading tree

- A disclosure is a link to more detail, or a supported control that reveals it. It sits under its true topic.

### Find the owning heading

- The owner is the most specific active heading whose topic includes that detail. Find it from the topic map, not from nearness, file length, or folder depth.
- Put the link in the owner's section at the point of need: after enough context to explain it, before the first action that needs it, and before a sibling or shallower heading closes the section. Optional detail goes beside the claim it expands.
- Never put it in a neighboring H4, an unrelated H3, or a generic links section.
- A real child subsection keeps its heading and a short purpose statement. Never disguise it as a link label. At H6, use an in-section link and a child file. Keep the parent's core meaning, warnings, and next action visible.

### Place shared and required context

- A prerequisite shared by sibling sections goes under their nearest shared ancestor, before the first dependent branch. One that the whole file needs goes under the H1.
- Label each disclosure with its destination, scope, and trigger. Say if it is required before an action, required when a condition holds, or optional. Never make a required read look optional. A global index never replaces the local route.
- Section ownership is not prerequisite order. If a needed source belongs to a later branch, add an earlier route to it without moving it under a false parent.
- Route a conditional exception with its rule. Never hide a prerequisite until after its use, or move a route to the end of the file.

### Split without breaking the tree

- Record the source heading path, moved content, kept core, and reason. Move a whole non-core branch without changing its parent-child meaning, conditions, exceptions, or order.
- Keep any real subsection heading at the owning section, with the summary and link. The child file may restart its levels. Record how it belongs to the original branch.
- Update links, fragments, relative paths, and triggers after every move.

### Placement checks

- A collapsible block stays in its file and in loaded context, so it is not a split and cuts no lines. Keep it in its owning section. If the target strips it, use a supported in-place link or visible form and report the limit.
- Reject these even when links resolve: inactive branches loaded early, detail loaded after the work that needs it, a link past a closing sibling heading or under the wrong sibling, a late prerequisite, a detached links section, and a recursive child split.
- Keep unresolved ownership conflicts visible and withhold acceptance of the affected path.

## File size and splitting

### Keep every file below 200 lines

- Every Markdown file has at most 199 physical lines, counting blank lines, frontmatter, fences, and a last line with no newline.
- Run the 150-line review during drafting, before the next addition reaches 150, and at once for an existing file at or above 150.
- A core-content reason means more splitting would harm the file's core meaning, exact content, or readability. Record it.
- Never meet the cap by hiding text or using long lines.
- If an exact block that cannot be split, or a fixed single-file requirement, makes 199 impossible, state the conflict, ask for the smallest decision, and do not claim compliance.

### Split into linked files

- Define each file's core from its own purpose and reader: main point, essential context, always-needed rules, main steps, and checks. A child has its own core.
- Move long examples, detailed evidence, optional background, and branch-specific instructions into clearly named files. Reuse a fitting existing file.
- Replace each moved section with a brief description, a working relative link, and a reading trigger such as "Read this before doing X".
- Mandatory branch instructions stay mandatory, and the parent still says what to decide or do next.
- Each split must cut detail load and create a useful topic boundary. Never create one-child wrappers or push one oversized block down through more files.

### Create child directories correctly

- Create one level at a time. Before each level, check the immediate parent on disk, for the package and its output directories.
- A planned file, a broken link, or a file only in a deeper directory does not count.
- If the parent has no file, first save useful content there or use a fitting existing directory. Never add an empty placeholder.

## Reading order and cycles

- A required read is a file that another file needs read, loaded, or included first.

### Keep required reading free of cycles

- B is a required read of A whenever A needs B to be understood or carried out, even if this is stated only in prose. A link that supplies required context counts, whatever its label.
- Check the full graph, including required reads reached through other files, with paths resolved the same way everywhere. A shared reference used by several files is fine if no cycle results.
- Mark return links as navigation-only.
- At use time, track the active reading path to find cycles, and track completed reads to avoid needless reloads. Report the exact cycle path and stop the affected loading or delivery.
- Repair a cycle by fixing the owner, pulling out shared foundations, or adding an overview first. Never hide it by deleting a true required read or relabeling a required link as navigation.
- Keep every moved section reachable from the entry file through reading triggers. After each split, verify links, anchors, ledger locations, and reading order at every depth.

### Set the reading order

- State each file's required reads and trigger. Filename, link position, folder depth, alphabetical order, citation, and navigation create no required read without evidence.
- A package, service, approval, or physical resource is an execution need, not a required read. Reading about one never satisfies it or authorizes execution.
- Keep the topic tree, reading graph, software graph, evidence graph, and work schedule distinct. A topic may have several required reads but one heading parent.
- Record each edge's force (required, preferred, optional) and logic (all-of or any-of). A preferred read never becomes required, and alternatives never become load-them-all.
- Order active required reads so each comes before the file that needs it, and pick a clear order among independent items. A router may be read first, but its dependent instructions wait for their context.

## Source and rendered readability

- Judge readability in four parts: kept meaning, readable source, usable rendered content, and a clear route through related files.
- No syntax choice, score, or automated check proves readability for everyone. This package's grade, heading, and line rules are project rules, not universal standards.

### Check the source

- Test list continuation, nested code, and quotes in the target parser.
- Use hard breaks only where line endings matter, such as verse or an address. Never force line length with breaks, spaces, or nonbreaking spaces.
- Never carry a required fact or state by bold, italics, color, emoji, strike marks, or position alone. Make edited, deleted, inserted, highlighted, superscript, and subscript meaning explicit.
- Check escaped punctuation, entities, delimiters, and literal examples in source, output, and copied text. Scraped text often carries stray escapes.
- After splits or heading edits, recheck references, footnotes, glossary terms, abbreviations, assets, and citations from the owning file.
- Give a Mermaid or other complex diagram a title and description that reach the output, plus a text account of its data, relationships, and conclusion.

### Keep hidden and extension content usable

- Keep warnings visible before the action they govern, not inside a collapsed block. Hidden or alternate content stays reachable in reading and export paths.
- Keep metadata, raw HTML or TeX, comments, directives, components, embeds, includes, and substitutions distinct from prose. Check support before conversion.
- Never place content the reader needs only in comments, metadata, hover text, styling, or anything the target strips. Keep a usable fallback.

### Check the rendered output

- Test the rendered output apart from the source. Keep source faults, host faults, and untested behavior separate.
- Where the target permits, check zoom, reflow, text-spacing overrides, and reading order. Check contrast, including syntax highlighting and diagram labels.
- Check link names, table headers, control states, keyboard use, and assistive tools. A narrow screenshot is not a zoom test.
- Read hard passages in context. An average score can hide them. Explain required technical terms instead of cutting meaning to lower a score.
- A reading score, parser result, screenshot, accessibility-tree check, and reader study prove different things. State which ran and their limits.
- Never claim a screen-reader or comprehension test from an automated check.
