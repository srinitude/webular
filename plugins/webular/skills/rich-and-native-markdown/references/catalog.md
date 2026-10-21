# Markdown catalog

| Section | Use when | Do not use when | Related |
| --- | --- | --- | --- |
| [Choose the target and check a form](#choose-the-target-and-check-a-form) | Before picking any Markdown form | The target and every form are already settled | [Parsing rules and settings](#parsing-rules-and-settings) |
| [Core CommonMark and GFM forms](#core-commonmark-and-gfm-forms) | Paragraphs, headings, lists, code, links, tables, task items, HTML | Only a dialect form is in question | [Parsing rules and settings](#parsing-rules-and-settings) |
| [Notes, lists, attributes, containers, raw content](#notes-lists-attributes-containers-raw-content) | Footnotes, definition lists, attributes, Divs, HTML containers, raw output | The target is plain CommonMark with no extensions | [Links, anchors, code details, tables, metadata, citations](#links-anchors-code-details-tables-metadata-citations) |
| [Math, marks, edits](#math-marks-edits) | Math, sub/superscript, highlights, edit marks, emoji, keys, progress bars | The target has no math or mark support | [Parsing rules and settings](#parsing-rules-and-settings) |
| [Asides, folding, tabs, generic blocks](#asides-folding-tabs-generic-blocks) | Details, alerts, callouts, admonitions, tabs, captions, cards | The content is essential and must always show | [Host features, embedded views, shared content, mentions](#host-features-embedded-views-shared-content-mentions) |
| [Links, anchors, code details, tables, metadata, citations](#links-anchors-code-details-tables-metadata-citations) | Wiki links, anchors, code attributes, table variants, front matter, citations | A plain inline link or pipe table is enough | [Core CommonMark and GFM forms](#core-commonmark-and-gfm-forms) |
| [Dialect systems: MyST, Quarto, Markdoc, MDX](#dialect-systems-myst-quarto-markdoc-mdx) | Roles, directives, shortcodes, cells, tags, partials, JSX | The source must stay portable Markdown | [Parsing rules and settings](#parsing-rules-and-settings) |
| [Host features, embedded views, shared content, mentions](#host-features-embedded-views-shared-content-mentions) | Diagram fences, mentions, issue references, includes, GitLab or GitHub only forms | The text will be read outside that host | [Asides, folding, tabs, generic blocks](#asides-folding-tabs-generic-blocks) |
| [Parsing rules and settings](#parsing-rules-and-settings) | HTML grammar, parser flags, or compatibility options change how source reads | You only need a visible form | [Choose the target and check a form](#choose-the-target-and-check-a-form) |
| [Owner documentation](#owner-documentation) | Verifying a form or a support limit | A form is already verified for the target | [Choose the target and check a form](#choose-the-target-and-check-a-form) |

- Use this catalog before choosing forms for scraped page text, research reports, README files, skill files, and prompts. The targets are mostly GitHub-flavored Markdown and CommonMark.
- Each form uses the syntax its owner documents. The entries add only support limits, traps, and fallbacks.
- No final list of Markdown forms exists. Before you change an unknown form, find its owner. Never remove it or change its meaning without saying so.

## Choose the target and check a form

- Find the target in the request or its files, and use only the forms it supports. A form the target does not support may stay literal.
- Never invent facts, citations, image details, or syntax support.
- MMD6 and MMD7 mean MultiMarkdown 6 and 7. In examples, `\n` is a real newline, and any indentation described is real spaces.
- Test ambiguous marks (blank lines, indentation, fence length) and clashes. For example, `---` can be a thematic break, a heading underline, or a metadata fence.
- `~` can mean strikethrough or subscript. `^` can mean superscript, a block ID, or a block end. `$` can mean currency, math, or a host reference. Braces can hold attributes, data, or code that runs.
- Details, tabs, comments, footnotes, and eager includes remove no source lines and save no context. Use linked files with reading triggers instead.
- Includes, imports, partials, transclusions, substitutions, and required cross-references are dependencies when they supply content the reader needs. Keep links that only help navigation apart from them.
- Reading a manual is not a render test. Test sample syntax in each renderer you claim to support, and label dialect support you did not test.
- Check the source and the rendered meaning. Check escaping, fallbacks, nested containers, math versus currency, and literal versus runnable fences.
- Consider every form below, every form specific to the target, and every unfamiliar form in the input. Record each as used, ruled out, or unresolved, with a reason. One shared reason may cover several forms.
- Keep an unknown form unresolved until you know its owner and meaning. Do not rule a form out just because context is missing. Considering a form does not select it.
- One decision covers passages with the same purpose, meaning, and target limits. Reuse it only while all three stay the same.

## Core CommonMark and GFM forms

- No added rule: **plain text**, **paragraph**, **blank line**, **soft break**, **hard break**, **ATX heading**, **setext heading**, **thematic break**, **blockquote**, **bullet list**, **ordered list**, **list item and nesting**, **indented code**.
- No added rule: **fenced code**, **link definition**, **inline code**, **emphasis**, **strong emphasis**, **inline link**, **reference link**, **image**, **angle autolink**, **escape**, **character reference**.
- **HTML block:** use it only where the host allows it and no native form fits. It can stop Markdown parsing or be stripped.
- **Inline HTML:** use it only when no native form exists. Respect the host's HTML filter.

### Formal GFM extensions

- **Pipe table:** escape literal pipes, even in code spans. Cells hold inline content only, never blocks.
- **Task item:** a checkbox does not prove the work is done, and it may not be clickable.
- **Strikethrough:** use double tildes so it does not clash with subscript.
- **Extended autolink:** the rules for where a link ends and for punctuation differ by host.
- **Raw-HTML tag filter:** GFM filters `title`, `textarea`, `style`, `xmp`, `iframe`, `noembed`, `noframes`, `script`, and `plaintext`. It limits HTML output. It is not a form to write.

## Notes, lists, attributes, containers, raw content

- Each form names its dialect. Check that the target supports it, or keep the source form as it is.
- **Footnote:** not CommonMark, and GitHub wikis lack it. Indent continued note blocks. Put the marker next to the claim and the definition outside the core prose.
- **Definition list:** Pandoc also accepts `~`. Keep each dialect's blank lines and indentation.
- **Abbreviation:** `*[API]: ...` works in PHP Extra, kramdown, and Python-Markdown `abbr`. Pandoc's compatibility extension skips these definitions, so the expansion is not available.
- Pandoc only: **inline note** `^[...]` (no multiparagraph notes). **Numbered example list** `(@id)`, reset with `(1@id)`. **Line block** with `|` lines, which keeps lines and leading spaces, allows inline markup, and allows no nested blocks.
- **Fancy list:** use letter, roman, `1)`, and `#.` markers only to keep labels the text requires. Support varies. Pandoc uppercase letters with a period need two spaces.
- **Heading and element attributes:** `{#id .class key="value"}` support and placement depend on the dialect. In Pandoc, a heading `{-}` means `.unnumbered`, and `.unlisted` leaves a heading out of the contents.
- **kramdown attribute lists:** `{: ...}` goes after the element it describes. An ALD defines `{:name: .class}`, and `{: name}` reuses it. An IAL is the inline form. These differ from Pandoc attributes.
- **Bracketed span:** classes such as `.underline`, `.smallcaps`, and `.mark` need support from the output writer.
- **Fenced Div:** it groups blocks without raw HTML. Pandoc requires opening attributes. Nest Divs with clear fences.
- **Markdown inside HTML:** `markdown="1"` needs a matching close tag and valid spacing. Pandoc's defaults differ, and `markdown="block"` is dialect-specific. Obsidian does not parse Markdown inside HTML.
- **Native HTML containers:** with `native_divs` and `native_spans` on, `div` and `span` markup stays in the parsed document. Raw HTML is passed through instead.
- **Raw output:** `{=html}`, `{=latex}`, or the format you need skips Markdown parsing. Never combine a raw-format attribute with ordinary attributes. Writers that do not support it may drop it.
- **Raw TeX and macros:** define macros, for example with `\newcommand`, ahead of the text that uses them. Output support varies, and raw-attribute content expands differently.
- **MMD6 raw wildcard:** `{=*}` on a code span or block passes raw content to every output. It is MMD6 only. The MMD7 syntax chapter does not document it, so do not assume support.

## Math, marks, edits

- Math is an embedded language, so its commands are not separate Markdown forms. Never assume one delimiter policy across dialects.
- **Inline math:** dollar math works only where it is supported. GitHub and GitLab also accept dollar-backtick wrappers. kramdown uses `$$x$$` even inline.
- **Display math:** use a supported `$$` block or `math` fence. MyST labels dollar math with `(eq-id)` after the closing delimiter. Do not put `$$` inside a math fence unless its owner requires it.
- **Other math delimiters:** `\(...\)`, `\[...\]`, doubled-backslash forms, and AMS environments work only when enabled. Use them to keep the formula boundaries.
- **Subscript and superscript:** `~` and `^` pairs work only in dialects that support them. HTML `<sub>` and `<sup>` are the fallback. Spaces inside paired forms need escaping. Pandoc `short_subsuperscripts` also accepts `x^2` or `O~2`. Use math for complex relations.
- **Highlight and insertion:** `==marked==` works only where enabled. PyMdown `^^added^^` or `<ins>` marks an insertion. It is not decorative underlining.
- **CriticMarkup:** it marks proposed edits in review text. Spans that cross blocks can break previews. Accepting or rejecting a change is a separate action.
- **GitLab inline diff:** `{+ +}` or `[+ +]` adds, and `{- -}` or `[- -]` removes, for short changes. Match the bracket type. It is not CriticMarkup.
- **Emoji and icon shortcode:** `:name:` works only where enabled. Names depend on the provider, and Unicode emoji are plain text. Never let a symbol carry the only required meaning.
- **Keyboard notation:** use `<kbd>` or PyMdown `++ctrl+enter++`, in the step where the reader acts.
- **Typographic replacements:** turn on the smart quote, dash, ellipsis, or symbol transform you need, for editable prose only. `smart`, `old_dashes`, `smarty`, `smartquotes`, `replacements`, and `SmartSymbols` change text and add no structure. Protect exact text.
- **Progress indicator:** use PyMdown `[=50% "Half done"]` or a supported fraction, with styling, for measured status. Never invent progress.

## Asides, folding, tabs, generic blocks

- Folding, tabs, and annotations do not cut source lines or loaded context. They must not hide shared steps or essential rules the reader needs.
- **HTML details:** use it for long optional detail. Blank lines must separate the body from the tags, or the Markdown inside may not render.
- **GitHub-style alert:** use only GitHub's fixed set of types. It must stand alone, not inside other elements. Other hosts differ.
- **Obsidian callout:** Obsidian only. Types are lowercase and have aliases. `+` or `-` sets the start state.
- **Indented admonition:** Python-Markdown `admonition` and Material only. The body needs a four-space indent.
- **Collapsible admonition:** needs PyMdown `details`. `???+` starts open.
- **Content tabs:** need PyMdown `tabbed`. Use them for a choice of platform or language.
- **PyMdown quote callout:** needs callouts enabled. It extends the GitHub-style alert and the Obsidian callout with titles, `+` or `-` folding, pipe-separated classes, and nesting. GitHub does not inherit these extras. Every callout line needs an explicit `>`.
- **Generic blocks:** need PyMdown `blocks`. Nest them with longer fences. The built-in blocks are admonition, details, tab, define, html, and caption. Custom names need registration.
- **Generic tab:** do not enable it together with `tabbed`. **Generic definition:** do not enable it together with `def_list`. **Generic HTML wrapper:** parsing modes and HTML filtering still apply.
- **Caption block:** place it right after the image, table, or block it labels. Check that the installed PyMdown supports `blocks.caption`.
- **Annotations:** Material only, inside an `.annotate` block, for short notes at a phrase or a point in code. The essential content still needs a visible route.
- **Card/grid layout:** `grid cards` is an HTML and CSS theme recipe, not Markdown grammar. Use it for equal navigation choices. Keep a sensible order on narrow screens.
- **PyMdown bracket span:** needs `bracketspan` and `attr_list`. `{}` gives a span with no extras. Link references take precedence. Check that the installed PyMdown supports `bracketspan`.

## Links, anchors, code details, tables, metadata, citations

- Each form names its dialect. Check that the target supports it, or keep the source form as it is.
- **Wiki link:** use only the target's alias or fragment form. The pipe order differs: Obsidian `[[Note|label]]`, GitLab wiki `[[label|slug]]`. Pandoc has options for both orders. Python wikilinks does not imply alias support.
- **Block ID:** `^block-id` uses letters, numbers, and dashes. kramdown's lone `^` differs.
- **Note/media embed:** an embed (transclusion) pulls in another file. It creates a dependency and may load too much.
- **Source-only comment:** HTML, Obsidian `%%...%%`, a MyST `%` line, kramdown `{::comment}`, or MDX `{/*...*/}`. Comments are not secret storage and must not hide context the reader needs.
- **Parser control tags:** kramdown only (`{::nomarkdown}`, `{::options ... /}`). A lone `^` in column one ends a block. These are not portable Markdown.
- **Generated contents:** Python and GitLab `[TOC]`, GitLab `[[_TOC_]]`, MMD7 `{{TOC}}`. Place it near the start or at a section break. GitHub's automatic outline is interface behavior, not `[TOC]` syntax.
- **Heading references and anchors:** link only to a slug or explicit ID you have checked. Slug rules and duplicate suffixes vary, and explicit references can override implicit ones. Pandoc also resolves `[Heading]`, `[Heading][]`, and `[label][Heading]`. GitHub custom anchors may use `<a name="id"></a>`.
- **Code attributes:** fence options for ID, class, title, line numbers, and highlighted lines differ by dialect. Pandoc uses `{#sample .python .numberLines startFrom="10"}`. SuperFences options differ.
- **Inline code attributes and highlighting:** PyMdown starts the span with `#!language` or `:::language` plus a space. Highlighting never runs code.

### Tables and figures

- **Simple table:** one source line per row, so use it only for short cells.
- **Multiline table:** Pandoc only, with no spans.
- **Grid table:** Pandoc, for block or span cells. Omit interior borders for spans. Fixed-width alignment matters.
- **Table caption and attributes:** `Table: Caption {#id .class}` or `: Caption`, before or after the table. Attributes follow the caption.
- **kramdown table groups:** dash rows split header and body groups, and `=` marks the footer. Cells are single-line, and the rules differ from GFM.
- **MultiMarkdown 6 table variants:** repeated trailing pipes for column spans, `[Caption]`, and body groups separated by blank lines. The MMD7 table chapter does not document them, so do not assume the same support.
- **Figure and image attributes:** support for width, height, ID, and caption varies. Pandoc implicit figures can use the image description as the caption, so keep a separate useful alt text where needed.
- **MMD link attributes:** `[id]: image.png "title" width=20px height=30px` in reference definitions. This differs from brace attributes.
- **YAML metadata:** may close with `...`. Pandoc Markdown allows later blocks. Its CommonMark-family readers accept one block, at the start only.
- **Other metadata:** Pandoc `%` title lines, MMD `Title: Value`, and GitLab `+++` TOML and `;;;` JSON fences. Python meta accepts YAML-like fences but does not parse YAML. Keep the formats distinct.
- **Bibliographic citation:** Pandoc `@key` forms, including `[-@key]` and `@{...}` for complex keys. Formatting needs a bibliography, `citeproc`, and a CSL style. Never invent entries.
- **MMD6 citation:** `[p. 7][#key]` with `[#key]: Reference`. `[#Reference]` is inline, and `[Not cited][#key]` adds an uncited item. This is not Pandoc `@` syntax.
- **MMD6 glossary:** `[?term]` with `[?term]: Definition`, or `[?(term) Definition]`.
- **MMD6 abbreviation:** `[>ABC]` with `[>ABC]: Expanded name`, or `[>(ABC) Expanded name]`. It is not the Extra syntax.
- The MMD6 citation, glossary, and abbreviation forms are MMD6 only. The MMD7 chapters do not document them, so do not assume support.

## Dialect systems: MyST, Quarto, Markdoc, MDX

- Each system has its own parser rules and registered names. A name works only when the system defines it.
- Includes, partials, and substitutions are dependencies and may load eagerly. Never run cells, expressions, or includes just to format them.
- **MyST role** (registered names only), **directive** (backtick or `:::` fences, with longer outer fences when nested), **field list** (enable `fieldlist`).
- **MyST substitution:** values come from configuration or front matter. They work in prose but not in ordinary code fences, and they use Jinja. Count the dependency and reject circular substitution.
- **MyST target and reference:** a `(label)=` target before a block gives a stable cross-file target. Refer to it with a supported link or `{ref}`.
- **MyST document assembly:** `{include}` and `{toctree}` must be registered directives. Includes may load eagerly and do not load context selectively.
- **Quarto shortcode:** the built-ins are version, var, meta, env, pagebreak, kbd, video, include, embed, placeholder, lipsum, and contents. Names and arguments are extension data.
- **Quarto include and embed:** an include must stand alone on a line set off by blank lines. Paths resolve from the main document. Embed only approved computed content. Metadata and executable cells can affect the whole document.
- **Quarto callout:** `collapse` and appearance depend on the output format.
- **Quarto cross-reference:** use the reserved prefixes `fig-`, `tbl-`, `eq-`, and `sec-`, with proper captions.
- **Quarto executable cell:** a `{python}` or `{r}` fence with `#|` options runs code. Highlighted literal code does not. Rewriting text gives no permission to run it.
- **Quarto page break:** `{{< pagebreak >}}` alone on a line between blocks, for print or export. It is not a thematic break.
- **Quarto keys and media:** the `kbd` and `video` shortcodes. Output support and accessibility still apply.
- **Markdoc tag:** the built-ins are if, else, table, and partial. Custom names need definitions.
- **Markdoc annotation:** attach it at the node that owns it, and quote strings with double quotes.
- **Markdoc variable and function:** the built-in functions are equals, and, or, not, default, and debug. A variable cannot simply be inserted into a Markdown link destination.
- **Markdoc condition:** keep shared rules the reader needs outside optional branches. **Markdoc partial:** it must be registered. Count it in dependency and context checks.
- **Markdoc table:** rows are lists separated by `---`, and cells may carry `colspan` or `align` annotations. It differs from pipe tables.
- **MDX JSX** replaces raw HTML, and component definitions must exist.
- **MDX expression:** `{expression}` is JavaScript, and comments use `{/*...*/}`. Do not run untrusted input just to format it.
- **MDX module statement:** keep valid `import` and `export` statements at module level. MDX lacks ordinary indented code blocks and angle autolinks, so do not apply CommonMark blindly.

## Host features, embedded views, shared content, mentions

- Host features work only on the named host, and some notify people or fetch content. Includes and snippets are dependencies. Embedded languages keep their own grammar.
- **Diagram fence:** the source must be valid for its language. Configured GitLab targets can also use `plantuml` or Kroki-supported languages. Keep accessible descriptions.
- **Map fence:** `geojson` or `topojson` data must match its fence and be valid.
- **3D mesh fence:** an `stl` fence takes ASCII STL. Both fences work on supported GitHub surfaces only.
- **Responsive image:** use `picture` and `source` only where the host permits them. Give the `img` useful alt text. Ordinary image Markdown is the fallback.
- **Color preview:** a hex, rgb, or hsl value in inline code. GitHub shows it only in issues, pull requests, and discussions.
- **GitLab JSON table:** a `json:table` fence needs a valid object. Fields and caption are optional. `markdown:true` affects cells and caption, not fields.
- **GitLab audio and video:** image syntax pointing at an audio or video file. Dimensions may follow in braces. Provide captions or transcripts.
- **Code permalink embed:** a same-instance file permalink with a full commit SHA and a line range, alone in a paragraph. Host limits and reader access apply.
- **Mention:** use it only when an authorized message needs that recipient. Mentions may notify people.
- **Work and history reference:** use a real host ID, commit, or URL. GitHub also accepts `GH-123` and `owner/repo@SHA`. Shorthand differs in repository files and wikis.
- **Label and external autolink:** needs a supported label URL or a configured tracker prefix. Do not assume an integration from the token alone.
- **GitLab reference variants:** `!123`, `$123`, `&123`, `~label`, `%milestone`, `namespace/project>`, commit or range, `^alert#123`, `*iteration:"title"`, `[type:value]`. The types include issue, `work_item`, epic, cadence, vulnerability, `feature_flag`, contact, and `wiki_page`. `+` adds a title, and `+s` adds a supported summary. These work in GitLab text only, not in Markdown snippet files.
- **GitLab multiline quote:** an alert marker can follow the opening `>>>`. **GitLab placeholder:** `%{PLACEHOLDER}` is experimental and off by default, so never assume it is active.
- **Literate Haskell:** needs `+lhs`. It changes heading and quote parsing, so `>` lines are code, not an ordinary blockquote.
- **PyMdown snippet:** `--8<--` takes section or line selectors. Preprocessing also runs inside code fences, so escape demonstrations.
- **GitLab include:** `::include` must start the line and works only in supported files and wiki pages. Nested includes are ignored, so what the reader needs must not depend on recursive expansion.
- **MMD6 transclusion:** `{{file.md}}` or output-specific `{{file.*}}`. Resolve the configured path base and any cycles. The MMD7 syntax chapter does not document it, so do not assume support.

## Parsing rules and settings

- A setting changes how text is read. It adds no visible Markdown form. Turn on only the setting the target dialect needs, in the parser or output-tool configuration.
- HTML forms follow CommonMark's seven HTML block classes. Keep valid tag, comment, processing instruction, declaration, and CDATA syntax only where the host requires it.
- Tabs, line endings, Unicode, NUL, lazy continuation, and delimiter precedence are parsing rules, not extra forms. Apply them when you read or check syntax.
- Newlines: `escaped_line_breaks` is the hard break form. `hard_line_breaks` and `nl2br` force breaks, `ignore_line_breaks` removes paragraph newlines, and `east_asian_line_breaks` handles wide-character boundaries. These policies are not interchangeable.
- Boundaries: `blank_before_header`, `space_in_atx_header`, `blank_before_blockquote`, `lists_without_preceding_blankline`, `four_space_rule`, `sane_lists`, and `spaced_reference_links` change how blocks are recognized and continued.
- Literal parsing: `all_symbols_escapable`, `angle_brackets_escapable`, `intraword_underscores`, emphasis and attribute compatibility modes, quote parsing, and escape extensions change how delimiters work. In Pandoc, backslash-space can mean a nonbreaking space.
- IDs and paths: `auto_identifiers`, `ascii_identifiers`, `gfm_auto_identifiers`, `mmd_header_identifiers`, `implicit_header_references`, and `rebase_relative_paths` control targets and path lookup. MMD heading IDs can be written `# Heading [id] #`. Keep the correct source-file path base.
- Feature switches such as `fenced_code_blocks`, `raw_html`, `raw_tex`, `native_divs`, `native_spans`, `markdown_in_html_blocks`, `footnotes`, `inline_notes`, `citations`, `alerts`, `mark`, `emoji`, and the math flags turn on the matching forms above. Python-Markdown bundles such as Extra name features, not syntax.
- `sourcepos` adds source-location metadata, and `gutenberg` affects plain-text output. Neither is authored structure. Templates, filters, CSS classes, highlighters, citation styles, and output layouts are separate processing layers.

## Owner documentation

- This is a syntax inventory checked against these owner pages. It is not a parser conformance audit. Never use a crawl date as a publication date.
- CommonMark `https://spec.commonmark.org/0.31.2/`; original Markdown `https://daringfireball.net/projects/markdown/syntax`; GFM `https://github.github.io/gfm/`.
- GitHub `https://docs.github.com/en/get-started/writing-on-github/`; GitLab `https://docs.gitlab.com/user/markdown/`.
- Pandoc `https://pandoc.org/demo/example33/` and `https://pandoc.org/MANUAL.html`.
- MultiMarkdown `https://fletcher.github.io/MultiMarkdown-7/docs/user.html`; MMD6 `https://fletcher.github.io/MultiMarkdown-6/syntax/`.
- PHP Markdown Extra `https://michelf.ca/projects/php-markdown/extra/`; kramdown `https://kramdown.gettalong.org/syntax.html`; Python-Markdown `https://python-markdown.github.io/extensions/`.
- PyMdown `https://facelessuser.github.io/pymdown-extensions/`; Material `https://squidfunk.github.io/mkdocs-material/reference/`.
- MyST `https://myst-parser.readthedocs.io/en/stable/syntax/`; Obsidian `https://obsidian.md/help/`.
- Quarto `https://quarto.org/docs/authoring/`; Markdoc `https://markdoc.dev/docs/`; MDX `https://mdxjs.com/docs/what-is-mdx/`.
