// The dev set for the answer and research accuracy evals: small fixture pages
// served by a local server, and the questions asked of them. `gold` is the fact
// a right answer must state; `null` marks a question no page answers.

export interface Page {
  readonly title: string
  readonly paras: ReadonlyArray<string>
}
export interface DevCase {
  readonly name: string
  readonly ask: string
  readonly gold: string | null
  readonly pages: ReadonlyArray<Page>
}

const page = (title: string, ...paras: string[]): Page => ({ title, paras })
const kestrel = page(
  'Kestrel Bridge',
  'The Kestrel Bridge spans the Orrin River in the town of Valemont.',
  'The Kestrel Bridge opened to traffic in 1921 after six years of work.',
  'Its main span is 214 meters long and carries two lanes of traffic.',
)
const lumen = page(
  'Lumen fern',
  'The lumen fern is a small fern that grows on wet limestone cliffs.',
  'The lumen fern glows faintly green because of a fungus that lives in its leaves.',
  'It was first described by the botanist Mara Quill in 1887.',
)
const harrow = page(
  'Harrow Lake',
  'Harrow Lake is a cold mountain lake in the northern Telas range.',
  'Harrow Lake reaches a depth of 312 meters at its deepest point.',
  'The lake freezes over for about four months each winter.',
)
const tolva = page(
  'Tolva language',
  'Tolva is a language spoken on the island of Brenna.',
  'Tolva has about 40,000 speakers, most of them in the port town of Sile.',
  'The Tolva alphabet has 24 letters and was written down by missionaries.',
)
const cobalt = page(
  'Cobalt Rail',
  'Cobalt Rail is a freight railway company based in the city of Dunmere.',
  'Cobalt Rail was founded in 1958 by the engineer Ivo Brandt.',
  'The company runs about 900 kilometers of track across three provinces.',
)
const pellam = page(
  'Pellam Observatory',
  'The Pellam Observatory sits on the summit of Mount Arden.',
  'The observatory houses a reflecting telescope with a mirror 2.4 meters wide.',
  'Pellam Observatory began regular observations in 1964.',
)
const garden = page(
  'Garden snails',
  'Garden snails move slowly across damp soil at night.',
  'They feed on leaves, fruit, and the soft stems of young plants.',
  'A garden snail can live for several years in a sheltered garden.',
)

const ask = (name: string, q: string, gold: string | null, ...pages: Page[]): DevCase => ({
  name,
  ask: q,
  gold,
  pages,
})

// answer: every case reads its pages with --urls; three have no answer in them.
export const ANSWER_DEV: ReadonlyArray<DevCase> = [
  ask('bridge opening year', 'When did the Kestrel Bridge open?', '1921', kestrel, garden),
  ask('bridge span', 'How long is the main span of the Kestrel Bridge?', '214 meters', kestrel),
  ask('why the fern glows', 'Why does the lumen fern glow?', 'fungus', lumen, harrow),
  ask('fern first described by', 'Who first described the lumen fern?', 'Mara Quill', lumen),
  ask('lake depth', 'How deep is Harrow Lake?', '312 meters', harrow, tolva),
  ask('language speakers', 'How many speakers does Tolva have?', '40,000', tolva),
  ask('railway founder', 'Who founded Cobalt Rail?', 'Ivo Brandt', cobalt, pellam),
  ask('mirror width', 'How wide is the Pellam Observatory mirror?', '2.4 meters', pellam),
  ask('no answer: bridge architect', 'Who was the architect of the Kestrel Bridge?', null, kestrel),
  ask('no answer: lake fish', 'Which fish live in Harrow Lake?', null, harrow),
  ask('no answer: off-topic pages', 'What is the population of Valemont?', null, garden, tolva),
]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
export const pagePath = (p: Page) => `/dev/${slug(p.title)}`
export const pageHtml = (p: Page) =>
  `<!doctype html><html><head><title>${p.title}</title></head><body><article><h1>${p.title}</h1>${p.paras.map((t) => `<p>${t}</p>`).join('')}</article></body></html>`
