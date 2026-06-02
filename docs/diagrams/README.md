# webular — Design Diagrams

These 7 mermaid diagrams are the **design basis** for all downstream work
(mise task graph → tests → code). They are authored as `.mmd` and rendered to
`.svg` with `mmdc` (`@mermaid-js/mermaid-cli`). Regenerate with
`mise run run:diagram` or `bunx mmdc -i <name>.mmd -o <name>.svg`.

| # | Diagram | Type | What it defines |
|---|---------|------|-----------------|
| 01 | [sequence](01-sequence.mmd) | sequenceDiagram | Runtime flow: CLI → mise → Mastra workflow → FOSS tool |
| 02 | [class](02-class.mmd) | classDiagram | Module/class structure the code implements |
| 03 | [state](03-state.mmd) | stateDiagram | Invocation / run lifecycle (sync + async) |
| 04 | [er](04-er.mmd) | entityRelationshipDiagram | Data model persisted in bun:sqlite |
| 05 | [journey](05-journey.mmd) | userJourney | User research journey, cold install → report |
| 06 | [requirement](06-requirement.mmd) | requirementDiagram | Project rules traced to system elements |
| 07 | [mindmap](07-mindmap.mmd) | mindmap | 12-domain capability taxonomy → FOSS libraries |

- Feature source of truth: [`research/INVENTORY.md`](../../research/INVENTORY.md)
- FOSS building blocks: [`research/FOSS.md`](../../research/FOSS.md)
- Repo/source cache manifest: [`research/REPOS.md`](../../research/REPOS.md)
