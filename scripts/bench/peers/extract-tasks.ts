// Extract gold: stable public pages and the fields to pull from each. The
// field specs ("name:selector") feed webular; the same names become the
// Firecrawl JSON schema. A task passes when the JSON text holds the gold value.
import type { Task } from './model.ts'

export interface ExtractSpec {
  /** webular field spec, "name:css-selector" joined by commas */
  fields: string
  /** field names, the properties of the Firecrawl JSON schema */
  names: readonly string[]
}

// Keyed by page URL: an adapter receives only the task input.
export const extractSpecs: Readonly<Record<string, ExtractSpec>> = {
  'https://example.com/': { fields: 'title:h1', names: ['title'] },
  'https://en.wikipedia.org/wiki/Ada_Lovelace': {
    fields: 'born:.infobox-data',
    names: ['born'],
  },
  'https://www.iana.org/domains/reserved': { fields: 'heading:h1', names: ['heading'] },
}

const extract = (id: string, url: string, gold: string): Task => ({
  id,
  job: 'extract',
  suite: 'extract',
  input: { url },
  checks: [{ kind: 'contains', values: [gold] }],
})

export const extractTasks: readonly Task[] = [
  extract('extract-example-title', 'https://example.com/', 'Example Domain'),
  extract('extract-wikipedia-lovelace-born', 'https://en.wikipedia.org/wiki/Ada_Lovelace', '1815'),
  extract('extract-iana-reserved-heading', 'https://www.iana.org/domains/reserved', 'Reserved'),
]
