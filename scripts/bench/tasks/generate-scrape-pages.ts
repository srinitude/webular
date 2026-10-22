// One builder per page type. Each returns the snapshot bytes and its gold.
import { html, ps } from './generate-scrape-base'
import { byline, chrome, escapeHtml, paragraphs, place, sentence } from './generate-scrape-content'
import { blocked, foreign, lazy, pdfScan, pdfText, spa } from './generate-scrape-hard'

export type { Built } from './generate-scrape-base'

const article = (s: number) =>
  html(s, `Field report from ${place(s)}, issue ${s}`, ps(paragraphs(s, 4)), [
    sentence(s, 0),
    sentence(s, 9),
  ])

const forum = (s: number) => {
  const q = `How do I keep ${place(s)} gauges from drifting? (thread ${s})`
  const answers = [0, 1, 2].map(
    (k) =>
      `<div class="post"><span class="user">${byline(s + k)}</span><p>${escapeHtml(sentence(s, k + 3))}</p><span class="votes">${(s * 7 + k) % 40} votes</span></div>`,
  )
  return html(
    s,
    q,
    `<div class="question"><p>${escapeHtml(sentence(s, 1))}</p></div>${answers.join('\n')}`,
    [sentence(s, 1), sentence(s, 4)],
  )
}

const product = (s: number) => {
  const price = `$${(19 + ((s * 13) % 180)).toFixed(2)}`
  const specs = [
    ['Weight', `${(s % 9) + 1}.${s % 10} kg`],
    ['Color', ['slate', 'moss', 'rust', 'sand'][s % 4] ?? 'slate'],
    ['Model', `FX-${100 + s}`],
  ]
  const table = `<table><tr><th>Spec</th><th>Value</th></tr>${specs.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`
  return html(
    s,
    `Trail lantern model FX-${100 + s}`,
    `<p class="price">${price}</p>${ps([sentence(s, 2)])}${table}`,
    [price, sentence(s, 2)],
    { tables: [[['Spec', 'Value'], ...specs]] },
  )
}

const listing = (s: number) => {
  const items = Array.from(
    { length: 8 },
    (_, k) => `Item ${s}-${k}: ${sentence(s, k).slice(0, 48)}`,
  )
  return html(
    s,
    `Collection ${s}: goods from ${place(s)}`,
    `<ul>${items.map((t) => `<li><a href="/item/${s}/${encodeURIComponent(t.slice(0, 8))}">${escapeHtml(t)}</a></li>`).join('')}</ul>`,
    [items[0] ?? '', items[7] ?? ''],
  )
}

const docs = (s: number) => {
  const fn = `syncGauge${s}`
  const code = `export const ${fn} = (id: string) => fetchGauge(id, { retries: ${s % 5} })`
  return html(
    s,
    `API guide: ${fn}`,
    `${ps([sentence(s, 5)])}<pre><code class="language-ts">${escapeHtml(code)}</code></pre>${ps([sentence(s, 6)])}`,
    [code, sentence(s, 5)],
  )
}

const tables = (s: number) => {
  const rows = Array.from({ length: 5 }, (_, k) => [
    place(s + k),
    String((s * 31 + k * 17) % 997),
    `${(s + k) % 100}%`,
  ])
  const t = [['Site', 'Count', 'Share'], ...rows]
  const body = `<table><thead><tr>${t[0]?.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  return html(
    s,
    `Survey table ${s}`,
    `${ps([sentence(s, 7)])}${body}`,
    [sentence(s, 7), rows[2]?.[1] ?? ''],
    { tables: [t] },
  )
}

export const PAGE_TYPES = {
  article,
  forum,
  product,
  listing,
  docs,
  tables,
  'pdf-text': pdfText,
  'pdf-scanned': pdfScan,
  spa,
  'lazy-scroll': lazy,
  'non-english': foreign,
  blocked,
} as const

export type PageType = keyof typeof PAGE_TYPES
export const WITHOUT = (s: number) => Object.values(chrome(s))
