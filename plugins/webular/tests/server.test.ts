// Outcome evals for the webular MCP server: a real MCP client talks to the
// real server over stdio, against a real local web page. No mocks.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { cap, MAX_OUTPUT_CHARS } from '../src/budget.ts'
import descriptions from '../src/descriptions.json' with { type: 'json' }
import { call, run } from './mcp-harness.ts'

const toolNames = [
  'act',
  'answer',
  'audit',
  'batch',
  'crawl',
  'diagram',
  'doctor',
  'extract',
  'feed',
  'jev',
  'map',
  'media',
  'monitor',
  'parse',
  'research',
  'scrape',
  'search',
  'summarize',
  'tasks',
]

test('an agent sees one typed tool per webular outcome', () =>
  run((tools) =>
    Effect.sync(() =>
      expect(Object.keys(tools).sort()).toEqual(toolNames.map((n) => `webular_${n}`)),
    ),
  ))

test('scrape turns a web page into clean Markdown', () =>
  run((tools, site) =>
    call(tools, 'scrape', { url: site.href }).pipe(
      Effect.flatMap((result) =>
        Effect.sync(() => {
          expect(result).toContain('Webular turns web pages into clean text for agents.')
          expect(result).not.toContain('<article>')
        }),
      ),
    ),
  ))

test('summarize returns the key sentence of a text', () =>
  run((tools) =>
    call(tools, 'summarize', {
      text: 'Webular is a web research tool. It scrapes pages. It also maps sites.',
      sentences: 1,
    }).pipe(Effect.map((result) => expect(result).toContain('Webular'))),
  ))

test('map finds the links on a site', () =>
  run((tools, site) =>
    call(tools, 'map', { url: site.href, limit: 5 }).pipe(
      Effect.map((result) => expect(result).toContain('/second')),
    ),
  ))

test('a bad input is refused with a plain next step, not a crash', () =>
  run((tools) =>
    call(tools, 'scrape', { url: 'not a url' }).pipe(
      Effect.match({ onFailure: String, onSuccess: (s) => s }),
      Effect.map((result) => expect(result.toLowerCase()).toContain('url')),
    ),
  ))

test('a site that cannot be read comes back as an error result with a next step', () =>
  run((tools) =>
    call(tools, 'scrape', { url: 'http://127.0.0.1:1/' }).pipe(
      Effect.match({ onFailure: String, onSuccess: (s) => s }),
      Effect.map((result) => expect(result).toContain('Try another URL')),
    ),
  ))

test('every tool carries a title, read-only and open-world hints', () =>
  run((tools) =>
    Effect.sync(() => {
      const hints = tools['webular_scrape']?.mcp?.annotations
      expect(hints?.title).toBe('Scrape a page')
      expect(hints?.readOnlyHint).toBe(true)
      expect(hints?.openWorldHint).toBe(true)
      expect(tools['webular_media']?.mcp?.annotations?.readOnlyHint).toBe(false)
      expect(tools['webular_parse']?.mcp?.annotations?.openWorldHint).toBe(false)
    }),
  ))

test('every tool has one description and no description is orphaned', () =>
  run((tools) =>
    Effect.sync(() =>
      expect(
        Object.keys(descriptions.tools)
          .map((n) => `webular_${n}`)
          .sort(),
      ).toEqual(Object.keys(tools).sort()),
    ),
  ))

test('crawl follows links from the start page', () =>
  run((tools, site) =>
    call(tools, 'crawl', { url: site.href, limit: 2, depth: 1 }).pipe(
      Effect.map((result) => expect(result).toContain('/second')),
    ),
  ))

test('extract pulls the text a CSS selector points at', () =>
  run((tools, site) =>
    call(tools, 'extract', { url: site.href, selector: 'h1' }).pipe(
      Effect.map((result) => expect(result).toContain('Webular test page')),
    ),
  ))

test('an over-cap result is cut and marked truncated', () => {
  const big = { text: 'x'.repeat(MAX_OUTPUT_CHARS * 2) }
  const out = cap(big) as { truncated: boolean; text: string }
  expect(out.truncated).toBe(true)
  expect(out.text.length).toBe(MAX_OUTPUT_CHARS)
  expect(cap({ ok: 1 })).toEqual({ ok: 1 })
})

test('the cap stays under every host limit and a cursor pages through the rest', () => {
  expect(MAX_OUTPUT_CHARS).toBeLessThan(40_000)
  expect(MAX_OUTPUT_CHARS / 0.91).toBeLessThan(10_000)
  const big = { text: 'y'.repeat(MAX_OUTPUT_CHARS * 2) }
  const json = JSON.stringify(big)
  const pages: string[] = []
  let page = cap(big) as { cursor?: number; text: string }
  pages.push(page.text)
  while (page.cursor !== undefined) {
    page = cap(big, 'scrape', page.cursor) as { cursor?: number; text: string }
    pages.push(page.text)
  }
  expect(pages.length).toBe(3)
  expect(pages.join('')).toBe(json)
})

test('a tool takes a cursor and returns the same page the cap gives', () =>
  run((tools) =>
    call(tools, 'summarize', { text: 'Webular reads pages.', sentences: 1, cursor: 0 }).pipe(
      Effect.map((result) => expect(result).toContain('Webular')),
    ),
  ))
