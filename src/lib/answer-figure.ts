// The image arm for `answer`: when the image router says the lead source's
// answer sits in a picture, the answer cites that figure (src plus alt or
// caption) instead of claiming a sure text sentence. No new Jev decision: it
// reuses image.router, which skips Jev for zero images.
import { Effect } from 'effect'
import { z } from 'zod'
import { statesTypedAnswer } from './answer-passage.ts'
import type { PageImage } from './html-images.ts'
import {
  imageInventory,
  isSiteMark,
  type RawImage,
  routeImages,
} from './jev/decisions/image-router.ts'

export const pageImageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  srcset: z.string(),
  width: z.string(),
  height: z.string(),
  caption: z.string(),
})

const NEAR_CHARS = 160

// Shared helper: the HTML's PageImage records as the router's RawImage. Sizes
// the HTML leaves out read as 0; `near` is the caption, else the page's lead.
export const rawImages = (images: ReadonlyArray<PageImage>, pageText: string): RawImage[] =>
  images.map((i) => ({
    src: i.src,
    alt: i.alt,
    caption: i.caption,
    width: Number.parseInt(i.width, 10) || 0,
    height: Number.parseInt(i.height, 10) || 0,
    near: i.caption || pageText.slice(0, NEAR_CHARS),
  }))

export interface LeadSource {
  readonly url: string
  readonly text: string
  readonly images?: ReadonlyArray<PageImage> | undefined
}

interface FigureInput {
  readonly question: string
  readonly lead: LeadSource | undefined
}
// A site logo or wordmark never counts as the answer figure. Text that already
// states a place or name of the asked type keeps the text answer with no Jev
// call, so the router's image fallback (low confidence, timeout) cannot hide it.
const figureFor = ({ question, lead }: FigureInput) => {
  const images = (lead?.images ?? []).filter((i) => !isSiteMark(i.src))
  if (lead === undefined || images.length === 0 || statesTypedAnswer(lead.text, question))
    return Effect.succeed<PageImage | undefined>(undefined)
  const input = {
    question,
    page: { url: lead.url, excerpt: lead.text },
    images: imageInventory(rawImages(images, lead.text)),
  }
  return Effect.map(routeImages(input), (route): PageImage | undefined =>
    route === 'text' ? undefined : (images.find((i) => i.alt || i.caption) ?? images[0]),
  )
}
// The figure the answer cites: the first image with words to show, else the
// first image. Undefined (and the fallback when Jev fails) keeps the text answer.
export const answerFigure = Object.assign(figureFor, { def: { fallback: () => undefined } })

// The figure note opens the answer; the text sentences follow as context.
export const figureNote = (f: PageImage): string =>
  `The answer is shown in a figure, not stated in the page text: "${f.alt || f.caption || 'untitled figure'}" (${f.src}).`
