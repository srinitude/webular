// image router: does a question need the image arm (screenshots and image
// reads), or do the page words hold the answer? Text-only input, so no image
// header. A page with zero images skips Jev; low confidence takes the image arm.
import { Effect } from 'effect'
import type { Jev, JevRequest } from '../client.ts'
import { defineDecision } from '../define.ts'
import { agreedPick, bothOrders, CONFIDENCE_BAR, choice, menu, purpose } from '../payload/index.ts'

type Route = 'text' | 'image' | 'both'
const ROUTES: ReadonlyArray<Route> = ['image', 'text', 'both']
export type ImageKind = 'chart' | 'table' | 'diagram' | 'photo' | 'logo' | 'icon' | 'unknown'

// One <img> as the fetched HTML gives it; code fills `kind` from the file name.
export interface RawImage {
  readonly src: string
  readonly alt: string
  readonly caption: string
  readonly width: number
  readonly height: number
  readonly near: string
}
interface RouterImage extends Omit<RawImage, 'src'> {
  readonly file: string
  readonly kind: ImageKind
}
export interface RouterInput {
  readonly question: string
  readonly page: { readonly url: string; readonly excerpt: string }
  readonly images: ReadonlyArray<RouterImage>
}

const MAX_ITEMS = 8
const LARGE_PX = 280
const MAX_TEXT = 160
const MAX_EXCERPT = 1500
const KIND_WORDS: ReadonlyArray<readonly [ImageKind, RegExp]> = [
  ['logo', /logo|brand|wordmark|tagline/i],
  ['icon', /icon|sprite|avatar|button/i],
  ['chart', /chart|graph|plot|figure|fig\d/i],
  ['table', /table|tbl/i],
  ['diagram', /diagram|map|schematic|drawing/i],
  ['photo', /photo|img_|dsc_/i],
]
const kindOf = (file: string): ImageKind =>
  KIND_WORDS.find(([, re]) => re.test(file))?.[0] ?? 'unknown'
// A site logo, wordmark, or icon: page chrome that never holds an answer. The
// whole path counts, so a file in an icons folder is an icon.
export const isSiteMark = (src: string): boolean => {
  const kind = kindOf(src.split(/[?#]/)[0]?.replace(/^\w+:\/\/[^/]*/, '') ?? '')
  return kind === 'logo' || kind === 'icon'
}
const cut = (s: string): string => s.trim().slice(0, MAX_TEXT)

// image_inventory_build: pure parsing of the fetched <img> records, no judgment.
export const imageInventory = (raw: ReadonlyArray<RawImage>): ReadonlyArray<RouterImage> =>
  raw.slice(0, MAX_ITEMS).map(({ src, alt, caption, width, height, near }) => {
    const file = src.split(/[?#]/)[0]?.split('/').at(-1) ?? ''
    return {
      file,
      alt: cut(alt),
      caption: cut(caption),
      width,
      height,
      near: cut(near),
      kind: kindOf(file),
    }
  })

// The take-every-image arm: the pilot's baseline and the low-confidence fallback.
export const routeBaseline = (_input: RouterInput): Route => 'image'

const ROUTER_PURPOSE = purpose(
  'webular answers a question from a web page. Reading the pictures on a page costs time and money.',
  'Read pictures only when the answer is in one.',
  'A wrong skip loses an answer that only a picture holds.',
  'Alt text and captions are often missing. The page words can look complete while a picture holds the number.',
)
const ASK =
  'Where is the answer to `facts.question` most likely found on the page at `facts.page`? Look at the words in `facts.page.excerpt` and the pictures in `facts.images`. Pick image when the question asks for a value or label in a chart, table, scan, or photo, and the excerpt does not say it.'
const DESCRIBE: Record<Route | 'none', { what: string; not_for?: string }> = {
  image: {
    what: 'The answer is only in a picture, like a chart value, a table number, or a scanned page',
    not_for: 'Pages where the excerpt also says the fact',
  },
  text: {
    what: 'Only when the excerpt already says the fact',
    not_for: 'Questions about a value in a picture',
  },
  both: {
    what: 'Only when the excerpt has part of the answer and a picture has the rest',
    not_for: 'Pages with no pictures that help',
  },
  none: { what: 'Only when the question and the page do not fit together at all' },
}

const routerPayload = (input: RouterInput): JevRequest => ({
  state: {
    purpose: ROUTER_PURPOSE,
    facts: {
      question: input.question.slice(0, MAX_TEXT * 2),
      page: { url: input.page.url, excerpt: input.page.excerpt.slice(0, MAX_EXCERPT) },
      images: {
        count: input.images.length,
        large_count: input.images.filter((i) => Math.min(i.width, i.height) >= LARGE_PX).length,
        items: input.images,
      },
    },
  },
  // Both option orders (position check); the baseline arm comes first.
  questions: bothOrders(
    'route',
    choice(
      ASK,
      menu('image', ROUTES, (k) => DESCRIBE[k as Route | 'none'] ?? null),
    ),
  ),
})

export const routeDecision = defineDecision<RouterInput, Route>({
  name: 'image.router',
  sample: () => ({
    question: 'In the energy diagram, what value is labeled inside the nuclear bar?',
    page: {
      url: 'https://www.eia.gov/energyexplained/us-energy-facts/',
      excerpt: 'Nuclear power supplied 9% of U.S. energy.',
    },
    images: [
      {
        file: 'consumption-by-source-and-sector.png',
        alt: 'Nuclear Electric Power 9%',
        caption: '',
        width: 960,
        height: 640,
        near: 'U.S. energy consumption by source and sector',
        kind: 'chart',
      },
    ],
  }),
  subtasks: [
    {
      name: 'image_arm_router_choice',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'route' },
    },
  ],
  payload: routerPayload,
  read: (a, bar) => ROUTES.find((r) => r === agreedPick(a, 'route', bar)),
  bar: CONFIDENCE_BAR,
  fallback: routeBaseline,
  codeCheck: (pick) => ROUTES.includes(pick),
  evals: 'tests/jev/evals/image.router.json',
  docs: 'b0b26ab933a61b5d43ccccae5fbd009f445bfdcfd2808cac9e410a84f0fd8ca4',
})

// Page kinds that stay on text: the pilot keep rule failed for infographics.
const TEXT_PAGE_KINDS: ReadonlyArray<string> = ['infographic']

// Action step: zero images, or a page kind that stays on text, means text, with no Jev call.
export const routeImages = (
  input: RouterInput,
  pageKind?: string,
): Effect.Effect<Route, never, Jev> =>
  input.images.length === 0 || (pageKind !== undefined && TEXT_PAGE_KINDS.includes(pageKind))
    ? Effect.succeed('text')
    : routeDecision(input)
