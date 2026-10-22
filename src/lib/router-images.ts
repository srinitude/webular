// The image arm for `research`: a source whose answer sits in a picture lists
// its chart and table figures. Reuses image.router, which skips Jev for zero images.
import { Effect } from 'effect'
import { rawImages } from './answer-figure.ts'
import type { PageImage } from './html-images.ts'
import { imageInventory, type RawImage, routeImages } from './jev/decisions/image-router.ts'

export interface FigureInput {
  readonly question: string
  readonly url: string
  readonly text: string
  readonly images?: ReadonlyArray<PageImage> | undefined
}

// The chart and table images (first 8, as the router sees them), as report lines.
const figures = (raw: ReadonlyArray<RawImage>): string[] =>
  imageInventory(raw).flatMap((img, i) =>
    img.kind === 'chart' || img.kind === 'table'
      ? [`- Figure: ${img.caption || img.alt || img.file} (${raw[i]?.src ?? img.file})`]
      : [],
  )

// `image` or `both` lists the figures; `text` and zero images keep the
// text-only section. A failed call takes the router's baseline arm (image).
export const sourceFigures = Object.assign(
  (input: FigureInput) => {
    const raw = rawImages(input.images ?? [], input.text)
    return Effect.map(
      routeImages({
        question: input.question,
        page: { url: input.url, excerpt: input.text },
        images: imageInventory(raw),
      }),
      (route) => (route === 'text' ? [] : figures(raw)),
    )
  },
  { def: { fallback: (input: FigureInput) => figures(rawImages(input.images ?? [], input.text)) } },
)
