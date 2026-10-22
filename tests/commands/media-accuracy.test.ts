// MEDIA accuracy eval (offline): a page with every downloadable-media form is
// scored against a gold URL set written from the page design. The inventory
// must resolve relative URLs (incl. <base href>), expand srcset candidates,
// and list each URL once. The command case serves the page from the local
// fixture and scores the `media` field of `media --download --json`.
// Gap: screenshot/PDF need a browser and are not covered.
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, Schema } from 'effect'
import { parseHTML } from 'linkedom'
import { mediaUrlsFrom } from '../../src/lib/html-images.ts'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff, tmpDir } from '../_support/run.ts'

const PAGE = 'https://site.test/blog/post.html'
const html = `<html><head>
<meta property="og:image" content="/img/og.png">
<base href="https://site.test/assets/">
</head><body>
<img src="a.jpg" srcset="a-1x.jpg 1x, a-2x.jpg 2x">
<img src="a.jpg">
<img src="https://cdn.test/b.png">
<img src="data:image/gif;base64,R0lGOD">
<picture><source srcset="c.avif 400w, c-big.avif 800w" type="image/avif"><img src="c.jpg"></picture>
<video src="v/clip.mp4"><source src="v/clip.webm"><source src="v/clip.mp4"></video>
<audio src="/audio/pod.mp3"></audio>
<audio><source src="../audio/alt.ogg"></audio>
<img alt="no src">
</body></html>`

const GOLD = [
  'https://site.test/img/og.png',
  'https://site.test/assets/a.jpg',
  'https://site.test/assets/a-1x.jpg',
  'https://site.test/assets/a-2x.jpg',
  'https://cdn.test/b.png',
  'https://site.test/assets/c.avif',
  'https://site.test/assets/c-big.avif',
  'https://site.test/assets/c.jpg',
  'https://site.test/assets/v/clip.mp4',
  'https://site.test/assets/v/clip.webm',
  'https://site.test/audio/pod.mp3',
  'https://site.test/audio/alt.ogg',
]

const fx = useFixture(() => ({
  '/blog/post.html': () =>
    new Response(html.replaceAll('https://site.test', fx.origin), {
      headers: { 'content-type': 'text/html' },
    }),
}))

const score = (got: string[], gold: string[], label: string) =>
  Effect.gen(function* () {
    const hits = got.filter((u) => gold.includes(u)).length
    const recall = hits / gold.length
    const precision = got.length ? hits / got.length : 0
    const missed = gold.filter((g) => !got.includes(g)).join(' ')
    const extra = got.filter((g) => !gold.includes(g)).join(' ')
    yield* Effect.logInfo(
      `${label} recall=${recall.toFixed(3)} precision=${precision.toFixed(3)} n=${got.length} missed=${missed} extra=${extra}`,
    )
    expect(new Set(got).size).toBe(got.length)
    expect(precision).toBe(1)
    expect(recall).toBe(1)
  })

const decodeMedia = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Struct({ media: Schema.optional(Schema.Array(Schema.String)) })),
)

describe('webular media — page media inventory accuracy', () => {
  test(
    'precision, recall, and dedupe against the gold set',
    eff(score(mediaUrlsFrom(parseHTML(html).document, PAGE), GOLD, 'media-accuracy')),
  )

  test(
    'the media command reports the same inventory for a downloaded page',
    eff(
      Effect.gen(function* () {
        const dest = join(yield* tmpDir('webular-'), 'post.html')
        const url = `${fx.origin}/blog/post.html`
        const { code, out } = yield* runCli('src/commands/media.ts', [
          '--url',
          url,
          '-o',
          dest,
          '--json',
        ])
        expect(code).toBe(0)
        const gold = GOLD.map((g) => g.replace('https://site.test', fx.origin))
        const { media } = yield* decodeMedia(out)
        yield* score([...(media ?? [])], gold, 'media-command-accuracy')
      }),
    ),
    15_000,
  )
})
