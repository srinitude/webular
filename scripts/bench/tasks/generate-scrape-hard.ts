// Builders for the hard page types: PDFs, JavaScript pages, non-English pages,
// and blocked pages.
import { type Built, html, ps } from './generate-scrape-base'
import { byline, date, paragraphs, place, sentence } from './generate-scrape-content'
import { scannedPdf, textPdf } from './generate-scrape-pdf'

const pdfMeta = (
  s: number,
  title: string,
  bytes: Uint8Array,
  keep: ReadonlyArray<string>,
): Built => ({
  ext: 'pdf',
  bytes,
  title,
  author: byline(s),
  published: date(s),
  lang: 'en',
  with: keep,
})

export const pdfText = (s: number) => {
  const lines = [sentence(s, 0), sentence(s, 1), sentence(s, 2), `Total inspected: ${s * 3} units`]
  return pdfMeta(s, `Inspection memo ${s}`, textPdf(`Inspection memo ${s}`, lines), [
    lines[0] ?? '',
    lines[3] ?? '',
  ])
}

const WORDS = [
  'HARBOR',
  'LANTERN',
  'COPPER',
  'ORCHARD',
  'GRANITE',
  'FERRY',
  'CEDAR',
  'SIGNAL',
  'MEADOW',
  'TIDE',
  'QUARRY',
  'BRIDGE',
]
export const pdfScan = (s: number) => {
  const w = (k: number) => WORDS[(s * 5 + k) % WORDS.length] ?? 'TIDE'
  const lines = [
    `SCANNED NOTICE ${w(0)} ${w(1)}`,
    `THE ${w(2)} WORKS REOPEN`,
    `ASK FOR ${w(3)} DESK`,
  ]
  return pdfMeta(s, `Scanned notice ${s}`, scannedPdf(`Scanned notice ${s}`, lines), [
    lines[1] ?? '',
    lines[2] ?? '',
  ])
}

// The main text ships base64-encoded and a script writes it in, so a plain
// fetch with no JavaScript sees none of the gold snippets (the no-JS floor).
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')
const JS_LEVELS = ['light', 'heavy', 'lazy'] as const

const jsPage = (s: number, level: 'light' | 'heavy' | 'lazy') => {
  const data = b64(JSON.stringify(paragraphs(s, 3)))
  const render = `const d=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob('${data}'),c=>c.charCodeAt(0))));const put=()=>{document.getElementById('app').innerHTML=d.map(p=>'<p>'+p+'</p>').join('')};`
  const run =
    level === 'light'
      ? `${render}put();`
      : level === 'heavy'
        ? `${render}setTimeout(()=>requestAnimationFrame(()=>Promise.resolve().then(put)),400);`
        : `${render}const o=new IntersectionObserver(e=>{if(e.some(x=>x.isIntersecting)){put();o.disconnect()}});o.observe(document.getElementById('sentinel'));`
  const main = `<div id="app" data-state="loading">Loading...</div><div id="sentinel" style="margin-top:2400px"></div>`
  return html(
    s,
    `Live board ${s} (${level})`,
    main,
    [sentence(s, 0), sentence(s, 7)],
    { jsLevel: level },
    'en',
    '',
    `<script>${run}</script>`,
  )
}

export const spa = (s: number) => jsPage(s, JS_LEVELS[s % 2] ?? 'light')
export const lazy = (s: number) => jsPage(s, 'lazy')

const LANGS: ReadonlyArray<readonly [string, string, string]> = [
  ['de', 'Die Brücke über den Fluss wurde', 'neu vermessen und gestrichen'],
  ['fr', 'Le marché du port a rouvert', 'avec quarante nouveaux étals'],
  ['es', 'La biblioteca del barrio abrió', 'una sala de lectura nocturna'],
  ['ja', '港の灯台は今月', '新しいレンズに交換されました'],
  ['pt', 'A cooperativa de pesca registrou', 'uma safra recorde de sardinha'],
  ['it', 'Il frantoio della valle ha raccolto', 'olive da trecento famiglie'],
]
export const foreign = (s: number) => {
  const [lang, a, b] = LANGS[s % LANGS.length] ?? ['de', '', '']
  const lines = [`${a} ${place(s)} ${b} (${s}).`, `${a} ${place(s + 3)} ${b} (${s + 1}).`]
  return html(s, `${a} ${place(s)}`, ps(lines), lines, {}, lang)
}

const REASONS = ['robots', 'paywall', 'login', 'antibot'] as const
const BLOCK_TEXT: Record<(typeof REASONS)[number], string> = {
  robots: 'This page is listed under Disallow in robots.txt.',
  paywall: 'Subscribe to keep reading. You have reached your free article limit.',
  login: 'Please sign in to view this page. Username and password required.',
  antibot: 'Checking your browser before accessing the site. Verify you are human.',
}
export const blocked = (s: number) => {
  const reason = REASONS[s % REASONS.length] ?? 'robots'
  const teaser =
    reason === 'robots' ? ps(paragraphs(s, 1)) : `<div class="gate">${BLOCK_TEXT[reason]}</div>`
  return html(s, `Members update ${s}`, teaser, [], { status: 'blocked', reason })
}
