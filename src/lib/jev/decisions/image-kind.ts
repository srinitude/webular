// image kind: what kind of picture each kept image on a page is, so charts, tables,
// diagrams, infographics and pictures of text go to a reader and the rest are skipped.
// One request holds every image (state array, one Choice per image, asked in both
// option orders). Code makes the images sendable first (size, format, repeats) and
// routes by kind after; Jev only picks the kind. Low confidence reads, never skips.
import type { JevImage, JevRequest } from '../client.ts'
import { defineDecision } from '../define.ts'
import {
  agreedPick,
  bothOrders,
  CAPS,
  CONFIDENCE_BAR,
  choice,
  menu,
  purpose,
} from '../payload/index.ts'
import { KIND_SPEC } from './image-kind-spec.ts'

const IMAGE_KINDS = [
  'chart',
  'table',
  'diagram',
  'infographic',
  'product_photo',
  'other_photo',
  'text_image',
  'logo',
  'decoration',
] as const
export type ImageKind = (typeof IMAGE_KINDS)[number]
export interface PageImage extends JevImage {
  readonly ref: string // a fresh UUID, the key in `assets`
  readonly alt: string | null
  readonly caption: string | null
  readonly width: number
  readonly height: number
  readonly region: 'main_content' | 'header' | 'footer' | 'sidebar' | 'unknown'
  readonly repeats: number
}
export interface ImageKindInput {
  readonly url: string
  readonly title: string
  readonly question: string | null
  readonly images: ReadonlyArray<PageImage>
}

// An unsure image is read, never skipped. ponytail: a blunt rule; the pilot sets a finer one.
const UNSURE: ImageKind = 'infographic'
export const imageKindBaseline = (input: ImageKindInput): ImageKind[] =>
  input.images.slice(0, CAPS.fields).map(() => UNSURE)

const WHY = purpose(
  'webular reads a web page, and a page can hold dozens of images.',
  'Name the kind of each image, so the right ones get read closely.',
  'Reading every image is slow and costs money. Reading none loses facts held in charts and tables.',
  'Charts, tables, diagrams, infographics and pictures of text get read. Photos, logos and decoration are skipped.',
)

const ask = (i: number) =>
  `What kind of picture is \`facts.images[${i}].image\`? Go by what you see. Use \`facts.images[${i}].alt_text\` and \`facts.images[${i}].caption\` only as hints: they can be wrong. \`facts.page.title\` and \`facts.page.user_question\` say what the page is about.`

const imageFacts = (p: PageImage) => ({
  image: p.ref,
  alt_text: p.alt,
  caption: p.caption,
  shown_size: { width_px: p.width, height_px: p.height },
  where_on_page: p.region,
  times_on_page: p.repeats,
})

const imagePayload = (input: ImageKindInput): JevRequest => {
  const images = input.images.slice(0, CAPS.fields)
  return {
    assets: Object.fromEntries(
      images.map((p) => [p.ref, { type: 'image', format: p.format, data_base64: p.data_base64 }]),
    ),
    state: {
      purpose: WHY,
      facts: {
        page: { url: input.url, title: input.title, user_question: input.question },
        images: images.map(imageFacts),
      },
    },
    questions: Object.assign(
      {},
      ...images.map((_, i) =>
        bothOrders(
          `kind_${i}`,
          choice(
            ask(i),
            menu('chart', IMAGE_KINDS, (k) => KIND_SPEC[k as ImageKind] ?? null),
          ),
        ),
      ),
    ),
  }
}

const sampleImage = (n: number): PageImage => ({
  ref: `00000000-0000-4000-8000-00000000000${n}`,
  type: 'image',
  format: 'png',
  data_base64: 'iVBORw0KGgo=',
  alt: n ? null : 'Life expectancy by year',
  caption: null,
  width: 640,
  height: 400,
  region: 'main_content',
  repeats: 1,
})

export const imageKindDecision = defineDecision<ImageKindInput, ImageKind[]>({
  name: 'image.kind',
  sample: () => ({
    url: 'https://ourworldindata.org/life-expectancy',
    title: 'Life expectancy',
    question: null,
    images: [sampleImage(0), sampleImage(1)],
  }),
  subtasks: [
    {
      name: 'kind',
      primitive: 'choice',
      pattern: 'fan-out',
      payload: { question: 'kind_0' },
    },
  ],
  payload: imagePayload,
  read: (a, bar, input) =>
    input.images.slice(0, CAPS.fields).map((_, i) => {
      const pick = agreedPick(a, `kind_${i}`, bar)
      return IMAGE_KINDS.find((k) => k === pick) ?? UNSURE
    }),
  bar: CONFIDENCE_BAR,
  fallback: imageKindBaseline,
  codeCheck: (kinds, input) =>
    kinds.length === Math.min(input.images.length, CAPS.fields) &&
    kinds.every((k) => IMAGE_KINDS.includes(k)),
  evals: 'tests/jev/evals/image.kind.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})
