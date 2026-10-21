// A local stand-in for the two archive indexes map and crawl fall back to
// (Wayback CDX and Common Crawl CDX), plus the env that points every free
// source at it. The target site is a path the fixture does not serve, so its
// own fetch fails with a 404.
import { Config, Effect } from 'effect'
import { startFixture } from './fixture.ts'

const fixture = startFixture((origin) => {
  const archived = [`${origin}/site/docs`, `${origin}/site/blog`]
  const wayback = [
    ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode'],
    ...archived.map((url) => ['k', '20240101000000', url, 'text/html', '200']),
  ]
  const commonCrawl = archived
    .map((url) => JSON.stringify({ url, timestamp: '20240101000000', status: '200' }))
    .join('\n')
  return {
    '/cdx/search/cdx': () => Response.json(wayback),
    '/collinfo.json': () => Response.json([{ id: 'CC-TEST', 'cdx-api': `${origin}/cc/cdx` }]),
    '/cc/cdx': () => new Response(commonCrawl),
  }
})

// The failing site, the URLs the archives hold for it, and the CLI env whose
// free sources all answer from the fixture.
export const archived = Effect.gen(function* () {
  const { origin } = yield* fixture
  const PATH = yield* Config.String('PATH').pipe(Config.orElse(() => Config.String('Path')))
  const HOME = yield* Config.String('HOME').pipe(Config.withDefault('/tmp'))
  return {
    site: `${origin}/site/`,
    urls: [`${origin}/site/docs`, `${origin}/site/blog`],
    env: { PATH, HOME, WEBULAR_SOURCE_ORIGIN: origin, WEBULAR_SOURCE_GAP_MS: '0' },
  }
})
