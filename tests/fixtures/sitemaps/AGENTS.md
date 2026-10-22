# tests/fixtures/sitemaps/AGENTS.md

This folder holds hand-written sitemaps for the parsing guards. It follows [tests/fixtures/AGENTS.md](../AGENTS.md).

## What lives here

- [messy.xml](messy.xml) mixes comments, CDATA, entities, and uppercase tags in `<loc>`. [map-sitemap-xml.parsing.test.ts](../../engine/map-sitemap-xml.parsing.test.ts) reads it through `mise run bugs:parsing`.
