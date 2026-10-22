// image kind: the option card for each kind, shown to Jev.
import type { OptionSpec } from '../payload/index.ts'
import type { ImageKind } from './image-kind.ts'

const spec = (what: string, not_for: string, examples: string[]): OptionSpec => ({
  what,
  not_for,
  examples,
})
export const KIND_SPEC: Record<ImageKind, OptionSpec> = {
  chart: spec(
    'A graph of numbers, like a line, bar, pie or scatter chart, with axes or a legend.',
    'A drawing of parts or steps, which is diagram.',
    ['a line chart of prices by year', 'a bar chart of votes by state'],
  ),
  table: spec(
    'Rows and columns of values, shown as a picture.',
    'Plain sentences, which is text_image.',
    ['a screenshot of a results table', 'a scanned price list'],
  ),
  diagram: spec(
    'A drawing of parts, steps or links, often with labels and arrows.',
    'A graph of numbers, which is chart.',
    ['a flow chart', 'a labeled drawing of an engine'],
  ),
  infographic: spec(
    'A poster-like picture that mixes facts, numbers, icons and short text.',
    'One plain chart, which is chart.',
    ['a health tips poster with numbers', 'a census fact sheet graphic'],
  ),
  product_photo: spec(
    'A photo of a product for sale or a package, where the label or item matters.',
    'A photo of people or places, which is other_photo.',
    ['a cereal box photo', 'a shoe on a white background'],
  ),
  other_photo: spec(
    'A photo of people, places, animals or events.',
    'A photo whose main point is a product, which is product_photo.',
    ['a portrait of an author', 'a city street'],
  ),
  text_image: spec(
    'A picture whose main content is words to read, like a scanned page, a quote card or a screenshot of text.',
    'Rows and columns of values, which is table.',
    ['a scanned book page', 'a tweet screenshot'],
  ),
  logo: spec(
    'A brand mark, site name or badge.',
    'A product photo that shows a brand, which is product_photo.',
    ['a company logo in the header', 'a payment badge'],
  ),
  decoration: spec(
    'A picture that adds look and feel but no facts, like a banner, background, divider or icon.',
    'A picture with numbers or readable words.',
    ['a stock photo banner', 'a social share icon'],
  ),
}
