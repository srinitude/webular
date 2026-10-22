// The one Jev model name. Every request, eval, retry, and calibration check reads
// it: the highest released Jev model on docs.typesafe.ai/models. Aliases such as
// `jev-latest` and preview names such as `jev-preview` are not releases, so they
// never count. `mise run jev:latest-check` fails when a higher release is listed.
// Leaf module (no imports), so store.ts and client.ts can both read it.
export const JEV_LATEST_RELEASED = 'jev-1.14.0'

// A released model id is versioned: `jev-<major>.<minor>.<patch>`.
export const isReleasedModel = (model: string) => /^jev-\d+\.\d+\.\d+$/.test(model)

// `mise run jev:latest-check` reads the highest released id from the `Model ID`
// row of the docs models table. Aliases never match that row's versioned ids.
const ID = /jev-\d+\.\d+\.\d+/g
// Numeric collation compares each digit run as a number, so minor 14 beats minor 9.
export const isHigher = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true }) > 0
export const highestReleased = (text: string): string | undefined =>
  text
    .split('\n')
    .filter((l) => l.startsWith('| Model ID |'))
    .flatMap((l) => l.match(ID) ?? [])
    .reduce<string | undefined>(
      (best, id) => (best === undefined || isHigher(id, best) ? id : best),
      undefined,
    )
