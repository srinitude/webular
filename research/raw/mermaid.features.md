# Mermaid — Web Feature Catalog for Webular CLI

**Coverage**: totalUrls=100, deepReadCount=31 (all 31 pre-selected pages successfully scraped; zero errors)

**Purpose of this document**: catalog every primitive that the `webular` CLI will BUILD WITH when using Mermaid as its diagram-generation engine — diagram types, the `mmdc` CLI tool, the JS SDK API surface, configuration/theming, and FOSS alternatives for each layer.

---

## 1. Diagram Type Primitives (mermaid DSL)

Mermaid renders diagrams from plain-text DSL strings. Webular will generate these strings programmatically and then render them via the `mmdc` CLI or the JS `mermaid.render()` API.

### 1.1 Flowchart / Graph
- **Keyword**: `flowchart` or `graph`; directions: `LR`, `RL`, `TB`, `BT`
- **Key params**: node shapes (rectangle, rounded, stadium, subroutine, cylinder/database, circle, asymmetric, rhombus, hexagon, parallelogram, trapezoid, double-circle), edge types (solid/dotted/thick arrows, bidirectional), subgraphs, CSS `classDef`/`class`/`style`, click-callbacks/href links, `%%` comments
- **Layout engines**: `dagre` (default), `elk` (Eclipse Layout Kernel via `layout: elk`), `tidy-tree`
- **FOSS alternatives**: Generate SVG without mermaid — `d3-dag` (npm), `graphviz` + `@hpcc-js/wasm-graphviz` (npm), `viz.js` (npm/wasm), `elkjs` (npm)

### 1.2 Sequence Diagram
- **Keyword**: `sequenceDiagram`
- **Key params**: `participant`/`actor` declarations with stereotypes (`boundary`, `control`, `entity`, `database`, `collections`, `queue`), aliases (`as`/inline `"alias"` key), arrow types (solid/dotted, half-arrows v11.12.3+, bidirectional `<<->>` v11+, async `-)`, cross `-x`), `activate`/`deactivate`, `Note` (right/left/over), `loop`, `alt`/`else`, `opt`, `par`/`and`, `critical`/`option`, `break`, `rect rgb()` backgrounds, `autonumber` (with start/increment v11.15+), actor pop-up `link`/`links` menus, `create`/`destroy` participants (v10.3+), central connections `()` (v11.12.3+), CSS styling classes
- **Config object**: `mermaid.sequenceConfig` — `mirrorActors`, `actorFontSize`, `noteFontSize`, `messageFontSize`, margins
- **FOSS alternatives**: `js-sequence-diagrams` (npm), `plantuml-encoder` + PlantUML server, `zenuml` (integrated into mermaid as external diagram)

### 1.3 Class Diagram (UML)
- **Keyword**: `classDiagram`
- **Key params**: class members with visibility (`+`/`-`/`#`/`~`), method return types, generic types (`~T~`), annotations (`<<Interface>>`, `<<Abstract>>`, `<<Service>>`, `<<Enumeration>>`), 8 relationship types (inheritance `<|--`, composition `*--`, aggregation `o--`, association `-->`, dependency `..>`, realization `..|>`, lollipop `()--`), cardinality/multiplicity, namespaces with dot-notation and syntactic nesting (v11.15+), `hierarchicalNamespaces` config, `direction`, click interactions (link/callback), `classDef`/`cssClass` styling, `note`
- **Config key**: `MermaidConfig.class` → `ClassDiagramConfig` incl. `hideEmptyMembersBox`
- **FOSS alternatives**: `nomnoml` (npm), `yuml-md` (npm), PlantUML

### 1.4 State Diagram
- **Keyword**: `stateDiagram-v2` (recommended) / `stateDiagram`
- **Key params**: state declarations, transitions (`-->`), start/end `[*]`, composite states with `{}` nesting, choice `<<choice>>`, fork/join `<<fork>>`/`<<join>>`, notes (right/left of), concurrency `--`, `direction TB/LR`, `classDef` + `class`/`:::` styling, `accTitle`/`accDescr` accessibility labels
- **FOSS alternatives**: `xstate` (npm) for logic, `state-machine-viz` or `viz.js` for rendering

### 1.5 Entity Relationship Diagram (ER)
- **Keyword**: `erDiagram`
- **Key params**: entities with typed attributes (`string`, `int`, `float`), PK/FK/UK key decorators, comments on attributes, crow's-foot cardinality notation (zero-or-one `|o`, exactly-one `||`, zero-or-more `}o`, one-or-more `}|`), alias notation via natural-language (`zero or more`, `one or many`, `only one`), identifying (`--`) vs non-identifying (`..`) relationships, entity aliases (`p[Person]`), `direction TB/BT/LR/RL`, `classDef` / `style` node styling, `layout: elk` support
- **FOSS alternatives**: `erdplus` (web), `dbdiagram.io` (web), Sequelize/TypeORM schema → ER via custom render

### 1.6 User Journey Diagram
- **Keyword**: `journey`
- **Key params**: `title`, `section` groupings, tasks with syntax `Task name: <score 1-5>: <actor1, actor2>`
- **FOSS alternatives**: No direct FOSS equivalent; can be approximated with `d3` custom bars

### 1.7 Requirement Diagram (SysML v1.6)
- **Keyword**: `requirementDiagram`
- **Key params**: requirement types (`requirement`, `functionalRequirement`, `interfaceRequirement`, `performanceRequirement`, `physicalRequirement`, `designConstraint`), fields (`id`, `text`, `risk: Low/Medium/High`, `verifymethod: Analysis/Inspection/Test/Demonstration`), element blocks with `type`/`docref`, relationships (`contains`, `copies`, `derives`, `satisfies`, `verifies`, `refines`, `traces`), `direction TB/BT/LR/RL`, `classDef`/`style` styling
- **FOSS alternatives**: None with identical SysML syntax; PlantUML has partial support

### 1.8 Mindmap
- **Keyword**: `mindmap`
- **Key params**: indentation-based hierarchy, node shapes (`[]` square, `()` rounded, `(())` circle, `))..((` bang, `)..(`cloud, `{{}}` hexagon, default), `::icon(fa fa-*)` icon support, `:::` CSS class attachment, markdown strings (bold `**`, italic `*`, auto-wrap), layouts: default radial or `tidy-tree` (via `config: layout: tidy-tree`), async lazy-loading module from CDN
- **FOSS alternatives**: `markmap-lib` (npm — converts markdown to mindmap SVG), `jsmind` (npm)

### 1.9 Gantt Diagram
- **Keyword**: `gantt`
- **Key params**: `dateFormat` (dayjs format strings), `axisFormat` (d3-time-format), `tickInterval`, `excludes` (dates/days/weekends), `weekend friday/saturday`, task metadata (status tags: `done`, `active`, `crit`, `milestone`, `vert`), after/until dependency chains, `compact` display mode, milestones (zero duration), vertical markers `vert` (v11+), `todayMarker` styling, click interactions, `titleTopMargin`, `barHeight`, `barGap`, `topPadding`, `rightPadding`, `leftPadding`, `numberSectionStyles`, `topAxis`
- **FOSS alternatives**: `frappe-gantt` (npm), `dhtmlxGantt` (GPL), `vis-timeline` (npm)

### 1.10 GitGraph Diagram
- **Keyword**: `gitGraph` or `gitGraph LR:/TB:/BT:`
- **Key params**: `commit` (with `id`, `type: NORMAL/REVERSE/HIGHLIGHT`, `tag`), `branch` (with `order`), `checkout`/`switch`, `merge` (with `id`/`tag`/`type`), `cherry-pick id: "..." parent: "..."`, orientation (`LR` default, `TB`, `BT`), `parallelCommits` (v10.8+), config: `showBranches`, `showCommitLabel`, `mainBranchName`, `mainBranchOrder`, `rotateCommitLabel`, theme variables `git0`–`git7`, `gitBranchLabel0`–`7`, `commitLabelColor/Background/FontSize`, `tagLabel*`, `gitInv0`–`7`
- **FOSS alternatives**: `gitgraph.js` (npm), `git-graph` (npm)

### 1.11 C4 Diagram (Architecture)
- **Keyword**: `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`
- **Key params**: `Person`/`Person_Ext`, `System`/`SystemDb`/`SystemQueue`/`*_Ext`, `Boundary`/`Enterprise_Boundary`/`System_Boundary`, `Container`/`ContainerDb`/`ContainerQueue`/`*_Ext`/`Container_Boundary`, `Component`/`ComponentDb`/`ComponentQueue`/`*_Ext`, `Deployment_Node`/`Node`/`Node_L`/`Node_R`, relationship types (`Rel`, `BiRel`, `Rel_U/D/L/R/Back`, `RelIndex`), `UpdateElementStyle`, `UpdateRelStyle` (with `$offsetX`/`$offsetY`), `UpdateLayoutConfig` (`$c4ShapeInRow`, `$c4BoundaryInRow`)
- **FOSS alternatives**: PlantUML + C4-PlantUML stdlib (syntactically compatible), Structurizr

### 1.12 Architecture Diagram (v11.1.0+)
- **Keyword**: `architecture-beta`
- **Key params**: `group {id}({icon})[{title}] (in {parent})?`, `service {id}({icon})[{title}] (in {parent})?`, edges with direction `{id}:{T|B|L|R} {<}?--{>}? {T|B|L|R}:{id}`, `{group}` modifier for inter-group edges, `junction` nodes, built-in icons (`cloud`, `database`, `disk`, `internet`, `server`), iconify.design custom icons via registered packs, layout config: `randomize` (v11.14+), `nodeSeparation`, `idealEdgeLengthMultiplier`, `edgeElasticity`, `numIter` (fcose pass-through, v11.15+)
- **FOSS alternatives**: `cytoscape.js` + fcose layout (npm), `d3` custom graph layouts

### 1.13 Block Diagram
- **Keyword**: `block`
- **Key params**: `columns N`, block labels with all standard shapes (same as flowchart), `block:ID:width ... end` composite blocks, block arrows `<[label]>(direction)`, `space`/`space:N` empty cells, edge syntax `A --> B` / `A -- "text" --> B`, `classDef`/`class`/`style`, `%%` comments; author-controlled manual layout (no automatic positioning)
- **FOSS alternatives**: `d3` manual layout, `excalidraw` (web-based)

### 1.14 Timeline Diagram
- **Keyword**: `timeline` / `timeline TD`
- **Key params**: `title`, `section` groupings, time-period/event entries (`{period} : {event}`), multi-event per period, `<br>` line breaks, `direction LR/TD` (v11.14+), `disableMulticolor` config, theme variables `cScale0`–`cScale11` + `cScaleLabel0`–`11`, all 5 built-in themes
- **FOSS alternatives**: `vis-timeline` (npm), `timelinejs` (web)

### 1.15 XY Chart
- **Keyword**: `xychart` / `xychart horizontal`
- **Key params**: `title`, `x-axis [cats]` or `x-axis title min --> max`, `y-axis title min --> max`, `bar [vals]`, `line [vals]`, multiple bars/lines per chart, `showDataLabel`/`showDataLabelOutsideBar` (v11.14+), `plotColorPalette`, config: `width`, `height`, `titleFontSize`, `chartOrientation`, `xAxis`/`yAxis` AxisConfig (showLabel, showTitle, showTick, tickLength, axisLineWidth), theme variables under `xyChart` namespace
- **FOSS alternatives**: `chart.js` (npm), `d3` (npm), `observable-plot` (npm), `recharts` (npm)

### 1.16 Quadrant Chart
- **Keyword**: `quadrantChart`
- **Key params**: `title`, `x-axis Low --> High`, `y-axis Low --> High`, `quadrant-1/2/3/4 text`, data points `Name: [x, y]` (0–1 range), point direct styling (`radius`, `color`, `stroke-color`, `stroke-width`), `classDef`/`:::` class styling, config: `chartWidth`, `chartHeight`, `quadrantPadding`, `xAxisPosition`, `yAxisPosition`, `pointRadius`, many theme variables `quadrant*Fill`, `quadrant*TextFill`
- **FOSS alternatives**: `d3` scatter, `chart.js` bubble, `plotly.js` (npm)

### 1.17 Sankey Diagram (v10.3.0+)
- **Keyword**: `sankey`
- **Key params**: CSV-style input (`source,target,value`), empty lines allowed, double-quote escaping, `showValues: true/false`, `width`, `height`, `linkColor: source/target/gradient/#hex`, `nodeAlignment: justify/center/left/right`, `labelStyle: legacy/outlined` (v11.15+), `nodeWidth`, `nodePadding` (v11.15+), `nodeColors` map (v11.15+)
- **FOSS alternatives**: `d3-sankey` (npm), `plotly.js` sankey trace (npm), `google-charts` Sankey

### 1.18 Radar Diagram (v11.6.0+)
- **Keyword**: `radar-beta`
- **Key params**: `axis id["label"], id2["label"]`, `curve id["label"]{vals}` or key-value `{axis3: 30, axis1: 20}`, multiple curves per diagram, `showLegend true/false`, `max`, `min`, `graticule circle/polygon`, `ticks`, config: `width`, `height`, margins, `axisScaleFactor`, `axisLabelFactor`, `curveTension`, theme `cScale${i}`, radar-specific `axisColor`, `curveOpacity`, `graticuleColor`
- **FOSS alternatives**: `d3` radar (manual), `chart.js` radar (npm), `plotly.js` scatterpolar

### 1.19 Pie Chart
- **Keyword**: `pie` / `pie showData`
- **Key params**: `title`, `"label" : value` slices (positive values only), `textPosition 0.0–1.0`, `pieOuterStrokeWidth`, theme variables `pie1`–`pie12`, `pieTitleTextSize/Color`, `pieSectionTextSize/Color`, `pieLegendTextSize/Color`, `pieStrokeColor/Width`, `pieOuterStrokeWidth/Color`, `pieOpacity`
- **FOSS alternatives**: `chart.js` pie/doughnut (npm), `d3` arc, `plotly.js` pie

### 1.20 ZenUML Sequence Diagram
- **Keyword**: `zenuml`
- **Key params**: `title`, explicit participant declaration, `@Actor`/`@Database` annotators, `A as Alias`, sync messages (`A.method() { ... }`), async messages (`A->B: msg`), creation messages (`new A`/`new A(params)`), reply via assignment `a = A.method()`, `return result`, `@return`/`@reply` annotations, `while`/`for`/`forEach`/`loop` loops, `if/else if/else`, `opt {}`, `par {}`, `try/catch/finally`, `//` comments with markdown support, nesting with `{}`
- **External module**: `@mermaid-js/mermaid-zenuml` (CDN/npm), registered via `mermaid.registerExternalDiagrams([zenuml])`
- **FOSS alternatives**: `zenuml.com` standalone (Apache 2.0), `js-sequence-diagrams`

### 1.21 Packet Diagram (v11.0.0+)
- **Keyword**: `packet`
- **Key params**: bit-range syntax `start-end: "label"`, single bit `start: "label"`, auto-increment syntax `+N: "label"` (v11.7.0+), title via frontmatter, bit position annotations
- **FOSS alternatives**: `bitfield` (npm — ASCII bit fields), custom SVG/HTML table

---

## 2. Configuration & Theming Primitives

### 2.1 Frontmatter Config (v10.5.0+)
- **Format**: YAML block at top of diagram DSL with `---\nconfig:\n  key: val\n---`
- **Replaces**: deprecated `%%{init: {...}}%%` directives
- **Scope**: diagram-author level, merged on top of siteConfig
- **Key top-level fields**: `theme`, `themeVariables`, `themeCSS`, `look` (`neo`/`classic`/`handDrawn`), `layout`, `fontFamily`, `fontSize`, `logLevel`, `securityLevel`, `startOnLoad`, `htmlLabels`, `wrap`, `markdownAutoWrap`, `maxTextSize`, `maxEdges`, `deterministicIds`, `deterministicIDSeed`, `suppressErrorRendering`, `darkMode`, `handDrawnSeed`, plus all diagram-specific sub-objects (`flowchart`, `sequence`, `class`, `state`, `er`, `gantt`, `journey`, `timeline`, `gitGraph`, `c4`, `architecture`, `block`, `mindmap`, `requirement`, `sankey`, `pie`, `quadrantChart`, `xyChart`, `radar`, `packet`, `zenuml`, `elk`, `ishikawa`, `kanban`, `treeView`, `venn`, `wardley-beta`, `dompurifyConfig`)
- **FOSS alternatives**: N/A — this is the mermaid config format itself

### 2.2 Directives (Deprecated since v10.5.0)
- **Format**: `%%{ init: { "theme": "dark", "flowchart": { "curve": "linear" } } }%%`
- **Note**: Use frontmatter config instead; directives remain supported for backward compat

### 2.3 Themes
- **Built-in themes**: `default`, `neutral`, `dark`, `forest`, `base`, `neo`, `neo-dark`, `redux`, `redux-dark`, `redux-color`, `redux-dark-color`, `null`
- **Only `base` is modifiable** via `themeVariables`
- **Key themeVariables**: `primaryColor`, `primaryTextColor`, `primaryBorderColor`, `secondaryColor`, `tertiaryColor`, `lineColor`, `fontFamily`, `fontSize`, `background`, `darkMode`, `noteBkgColor`, `noteTextColor`, `mainBkg`, `errorBkgColor`, `errorTextColor`; plus diagram-specific variables (e.g., `pie1`–`pie12`, `actorBkg`, `actorBorder`, `git0`–`git7`, `cScale0`–`cScale11`, `quadrant*Fill`, `xyChart.*`)
- **themeCSS**: raw CSS override string
- **Color computation**: hex only (#rrggbb); derived colors auto-calculated from primaries
- **FOSS alternatives**: `postcss` / custom CSS injected into SVG

### 2.4 Initialize API
- `mermaid.initialize(config: MermaidConfig): void` — site-level config, called once before `run()`
- **FOSS alternatives**: N/A

---

## 3. JS SDK API Primitives (mermaid npm package)

### 3.1 Core Rendering
- **`mermaid.render(id, text, svgContainingElement?): Promise<RenderResult>`**
  - `id`: string — unique DOM id for the SVG
  - `text`: string — mermaid DSL source
  - `svgContainingElement?`: optional Element
  - Returns `RenderResult { svg: string; diagramType: string; bindFunctions?(element): void }`
  - `bindFunctions` must be called after inserting svg into DOM to wire click handlers
- **FOSS alternatives**: `mermaid` npm package itself; no direct alternative that understands mermaid DSL

### 3.2 Parsing
- **`mermaid.parse(text, parseOptions?): Promise<ParseResult | false>`**
  - `parseOptions.suppressErrors: boolean` — return `false` instead of throwing on invalid diagram
  - Returns `ParseResult { diagramType: string }` on success
  - Throws on invalid DSL unless suppressErrors is true
- **FOSS alternatives**: N/A (mermaid-specific parser)

### 3.3 Diagram Type Detection
- **`mermaid.detectType(text, config?): string`**
  - Detects diagram type from DSL text, respects `%%init` directive
  - Returns graph definition key (e.g., `"flowchart"`, `"sequence"`)

### 3.4 Run (DOM-mode)
- **`mermaid.run(options?: RunOptions): Promise<void>`**
  - Scans DOM for `.mermaid` elements, renders in-place
  - Marks processed elements with `data-processed` to prevent double-render
- **Deprecated**: `mermaid.init(config?, nodes?, callback?)` — use `initialize()` + `run()` instead

### 3.5 External Diagram Registration
- **`mermaid.registerExternalDiagrams(diagrams, opts?): Promise<void>`**
  - `diagrams`: `ExternalDiagramDefinition[]`
  - `opts.lazyLoad?: boolean` (default true)
  - Used to load optional modules: mindmap, zenuml, venn, etc.
- **`mermaid.getRegisteredDiagramsMetadata(): { id: string }[]`**

### 3.6 Icon Packs
- **`mermaid.registerIconPacks(iconLoaders: IconLoader[]): void`**
  - `IconLoader`: `SyncIconLoader | AsyncIconLoader`
  - Enables custom iconify icons in architecture diagrams

### 3.7 Layout Loaders
- **`mermaid.registerLayoutLoaders(loaders: LayoutLoaderDefinition[]): void`**
  - Allows registering custom layout engines (e.g., ELK, tidy-tree)

### 3.8 Error Handling
- **`mermaid.setParseErrorHandler(fn: (err, hash) => void): void`**
- **`mermaid.parseError?: ParseErrorFunction`** property

### 3.9 Config API (internal / mermaidAPI)
- `mermaidAPI.getConfig(): MermaidConfig`
- `mermaidAPI.getSiteConfig(): MermaidConfig`
- `mermaidAPI.setConfig(conf): MermaidConfig`
- `mermaidAPI.reset(): void`
- `mermaidAPI.globalReset(): void`
- `mermaidAPI.sanitize(conf): ...` — strips unsafe config keys per `secure[]` list
- `mermaidAPI.parse(text, parseOptions)` — same as `mermaid.parse`
- `mermaidAPI.render(id, text, svgContainingElement?)` — deprecated, use `mermaid.render`

---

## 4. CLI Primitives (mmdc — mermaid-cli)

The mermaid docs redirect CLI users to the `mermaid-cli` npm package (`@mermaid-js/mermaid-cli`, `mmdc` binary). Key capabilities inferred from docs references:

- **Input**: reads `.mmd` files (or stdin) containing mermaid DSL
- **Output formats**: SVG (default), PNG, PDF, Markdown-embed link
- **Config**: `--configFile <path>` JSON config, `--cssFile <path>`, `--theme <name>`
- **Usage in webular**: call `mmdc -i diagram.mmd -o diagram.svg` from a Bun subprocess
- **npm package**: `@mermaid-js/mermaid-cli` (MIT)
- **FOSS alternatives**: Use `mermaid.render()` in a headless Node/Bun script directly (no Chromium required for SVG output in newer versions); `puppeteer`/`playwright` for PNG/PDF fallback

---

## 5. URL Categorization (All 100 URLs from mermaid.urls.json)

### Syntax / Diagram Types (35 URLs)
| Bucket | URLs |
|--------|------|
| Diagram types | flowchart, sequenceDiagram, classDiagram, stateDiagram, entityRelationshipDiagram, userJourney, requirementDiagram, mindmap, gantt, gitgraph, c4, architecture, block, timeline, xyChart, quadrantChart, sankey, radar, pie, zenuml, packet, examples, venn, wardley, eventmodeling, ishikawa, treeView, treemap |
| Intro/reference | intro/index, intro/syntax-reference, intro/getting-started |
| Experimental/other | venn, wardley, eventmodeling, ishikawa, treeView, treemap |

### Configuration / API / Setup (47 URLs)
| Bucket | URLs |
|--------|------|
| Configuration | config/configuration, config/directives, config/theming, config/mermaidCLI, config/usage, config/icons, config/layouts, config/accessibility, config/faq, config/math, config/tidy-tree |
| Schema docs | config/schema-docs/config, config/schema-docs/config-properties-theme, config/schema-docs/config-properties-themecss, config/schema-docs/config-properties-loglevel, config/schema-docs/config-properties-look, config/schema-docs/config-properties-secure, config/schema-docs/config-properties-securitylevel, config/schema-docs/config-properties-elk, config/schema-docs/config-properties-maxedges, config/schema-docs/config-properties-wrap, config/schema-docs/config-properties-markdownautowrap, config/schema-docs/config-properties-handdrawnseed, config/schema-docs/config-properties-suppresserrorrendering, config/schema-docs/config-defs-sankeylinkcolor, config/schema-docs/config-defs-sankeylabelstyle, config/schema-docs/config-defs-sankeynodealignment |
| TypeScript interfaces | config/setup/README, config/setup/mermaid/README, config/setup/mermaid/interfaces/MermaidConfig, config/setup/mermaid/interfaces/Mermaid, config/setup/mermaid/interfaces/RenderResult, config/setup/mermaid/interfaces/ParseOptions, config/setup/mermaid/interfaces/ExternalDiagramDefinition, config/setup/mermaid/interfaces/RenderOptions, config/setup/mermaid/interfaces/SyncIconLoader, config/setup/mermaid/interfaces/AsyncIconLoader, config/setup/mermaid/interfaces/LayoutLoaderDefinition, config/setup/mermaid/interfaces/UnknownDiagramError, config/setup/mermaid/interfaces/DetailedError, config/setup/mermaid/type-aliases/IconLoader, config/setup/mermaid/variables/default |
| Config functions | config/setup/config/README, config/setup/config/functions/reset, config/setup/config/functions/setSiteConfig, config/setup/config/functions/setConfig, config/setup/config/functions/sanitize, config/setup/config/functions/getEffectiveHtmlLabels, config/setup/config/functions/addDirective, config/setup/config/functions/updateCurrentConfig, config/setup/config/functions/evaluate, config/setup/config/functions/getSiteConfig, config/setup/defaultConfig/variables/default |

### Ecosystem / Community (18 URLs)
| Bucket | URLs |
|--------|------|
| Integration | ecosystem/integrations-create, ecosystem/integrations-community, ecosystem/tutorials, ecosystem/mermaid-chart |
| Community | community/intro, community/contributing, community/security, community/questions-and-suggestions, community/new-diagram, community/new-diagram-jison |
| News | news/blog, news/announcements |
| Other | open-source (home), adding-new-shape |

---

## 6. FOSS Library Summary by Layer

| Layer | Purpose | FOSS Libraries (npm/cargo/pypi) |
|-------|---------|--------------------------------|
| Mermaid render (JS) | Generate SVG from DSL | `mermaid` (MIT, npm) |
| Mermaid CLI | Batch render to SVG/PNG/PDF | `@mermaid-js/mermaid-cli` (MIT, npm) |
| Alternative graph render | Flowcharts without mermaid DSL | `graphviz` + `@hpcc-js/wasm-graphviz` (npm), `d3-dag` (ISC, npm), `elkjs` (EPL-2.0, npm), `viz.js` (MIT, npm) |
| Sequence diagrams | Alternative to mermaid sequence | `js-sequence-diagrams` (BSD, npm), `mermaid-zenuml` (Apache-2, npm) |
| Class/UML diagrams | Alternative to classDiagram | `nomnoml` (MIT, npm), `plantuml-encoder` (MIT, npm) |
| Gantt charts | Project scheduling | `frappe-gantt` (MIT, npm), `vis-timeline` (MIT, npm) |
| XY charts (bar/line) | Data visualization | `chart.js` (MIT, npm), `d3` (ISC, npm), `observable-plot` (ISC, npm), `recharts` (MIT, npm) |
| Sankey | Flow diagrams | `d3-sankey` (ISC, npm) |
| Radar/polar | Multi-dimension comparison | `chart.js` radar (npm), `d3` (custom) |
| Mindmaps | Hierarchical notes | `markmap-lib` (MIT, npm), `jsmind` (BSD, npm) |
| Architecture/graph | Cloud diagrams | `cytoscape` + `cytoscape-fcose` (MIT, npm) |
| Timeline | Chronological events | `vis-timeline` (MIT, npm) |
| Git graphs | Branch visualization | `gitgraph.js` (MIT, npm) |
| C4/architecture | System context diagrams | `structurizr-dsl` + plantuml-stdlib (Apache-2) |
| SVG manipulation | Post-processing rendered SVGs | `svgo` (MIT, npm), `@svgdotjs/svg.js` (MIT, npm) |
| Theming / CSS | Dynamic CSS injection into SVG | `postcss` (MIT, npm) |
| Parsing validation | Validate mermaid DSL before render | `mermaid` own `parse()` API |

---

## 7. Unique Capabilities / Integration Notes for Webular

1. **Headless rendering without Chromium**: `mermaid.render(id, text)` in a Bun/Node script produces SVG strings directly (no DOM needed for SVG output via v11+ JSDOM integration in `@mermaid-js/mermaid-cli`).
2. **Text → SVG pipeline**: Webular can accept a mermaid DSL string, call `mermaid.render()`, and return the SVG — suitable as a build step or API endpoint.
3. **Diagram type auto-detection**: `mermaid.detectType(text)` allows routing diagrams to the right renderer or validator without pre-parsing.
4. **Frontmatter config injection**: Webular can prepend `---\nconfig:\n  theme: dark\n---\n` to user DSL strings to programmatically control output appearance.
5. **External diagrams (lazy-load)**: Mindmap, ZenUML, Venn, Wardley must be registered before first render; Webular should eagerly register all known external diagram types at startup.
6. **Security levels**: `securityLevel: 'strict'` (default) disables click events; `loose` enables JS callbacks. Webular should use `strict` for untrusted user input.
7. **Deterministic IDs**: Set `deterministicIds: true` + `deterministicIDSeed: "webular"` to ensure consistent SVG output across renders (important for caching/diffing).
8. **MermaidConfig sub-objects**: Each diagram type has its own config namespace in `MermaidConfig` — webular can expose per-diagram-type config overrides to users.
9. **mmdc vs JS API**: For server-side batch rendering, `mmdc` is the simplest option; for programmatic/inline rendering (e.g., inside a Bun HTTP handler), the JS API is preferred.
10. **RenderResult.bindFunctions**: When embedding SVG in HTML, always call `bindFunctions(containerElement)` after `innerHTML = svg` to activate click interactions.
