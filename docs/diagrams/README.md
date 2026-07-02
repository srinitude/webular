# webular — Design Diagrams

These 7 mermaid diagrams are the **design basis** for all downstream work
(mise task graph → tests → code). They are authored as `.mmd` and the rendered
`.svg` files are **committed** — `webular diagram` only lists them.

Regeneration is a **maintainer activity**: `bunx mmdc -i <name>.mmd -o <name>.svg`.
mmdc drives Puppeteer, whose Chromium download is blocked by this package's
`trustedDependencies` policy, so a fresh install has no browser. Point mmdc at
an existing browser via `-p puppeteer.json` with
`{"executablePath": "<path to Chrome>"}` — e.g. the one `agent-browser install`
provisions under `~/.agent-browser/browsers/`.

| # | Diagram | Type | What it defines |
|---|---------|------|-----------------|
| 01 | [sequence](01-sequence.mmd) | sequenceDiagram | Runtime flow: CLI → mise → Mastra workflow → FOSS tool |
| 02 | [class](02-class.mmd) | classDiagram | Module/class structure the code implements |
| 03 | [state](03-state.mmd) | stateDiagram | Invocation / run lifecycle (sync + async) |
| 04 | [er](04-er.mmd) | entityRelationshipDiagram | Data model persisted in bun:sqlite |
| 05 | [journey](05-journey.mmd) | userJourney | User research journey, cold install → report |
| 06 | [requirement](06-requirement.mmd) | requirementDiagram | Project rules traced to system elements |
| 07 | [mindmap](07-mindmap.mmd) | mindmap | 12-domain capability taxonomy → FOSS libraries |

> **Note:** these are **design-phase** artifacts. Some nodes name candidate
> libraries explored during design (e.g. Playwright, yt-dlp, sitemapper) that the
> shipped CLI does not use; the actual runtime dependencies are the ones declared
> in the root [`package.json`](../../package.json).
