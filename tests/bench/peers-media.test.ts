// Contract for the media job: the Firecrawl screenshot request and Output, the
// webular PNG check, and the grade a media task gives (an image came back).
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { answerAccuracy } from '../../scripts/bench/peers/grade.ts'
import {
  firecrawlMedia,
  imageReturned,
  mediaInput,
  savedImage,
} from '../../scripts/bench/peers/media-jobs.ts'
import { mediaTasks } from '../../scripts/bench/peers/media-tasks.ts'
import { fail } from '../../scripts/bench/peers/peers.ts'
import { recorded } from './replay.ts'

const task = mediaTasks.find((t) => t.id === 'media-example-com')
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

test('firecrawl media posts the screenshot format and returns the image URL', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post, seen } = recorded({
        success: true,
        data: { screenshot: 'https://s.test/a.png' },
      })
      const call = firecrawlMedia(post, 'k').media
      const o = yield* call ? call({ url: 'https://example.com/' }) : Effect.die('no media')
      expect(seen[0]?.url).toBe('https://api.firecrawl.dev/v2/scrape')
      expect(seen[0]?.headers).toEqual({ authorization: 'Bearer k' })
      expect(seen[0]?.body).toEqual({ url: 'https://example.com/', formats: ['screenshot'] })
      expect(o.text).toBe('image:https://s.test/a.png')
    }),
  ))

test('webular media counts a saved PNG as an image and a non-PNG as a failure', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const save = (body: Uint8Array) =>
        Effect.gen(function* () {
          const { dest } = yield* mediaInput('u')
          yield* Effect.tryPromise({ try: () => Bun.write(dest, body), catch: fail })
          return { savedTo: dest, bytes: body.length }
        })
      const good = yield* savedImage(yield* save(png), 'u')
      expect(good.text).toBe(`image:png ${png.length} bytes`)
      const html = new TextEncoder().encode('<html></html>')
      const bad = yield* savedImage(yield* save(html), 'u').pipe(Effect.flip)
      expect(bad.message).toContain('no PNG')
    }),
  ))

test('a media task passes only when an image came back', () => {
  expect(task).toBeDefined()
  if (!task) return
  expect(answerAccuracy(task, imageReturned('https://s.test/a.png', 'u', 0, 0))).toBe(1)
  expect(answerAccuracy(task, { ...imageReturned('', 'u', 0, 0), text: 'no image' })).toBe(0)
})

test('media tasks are a local fixture page and a public https page', () => {
  expect(mediaTasks.map((t) => [t.job, t.localOnly === true])).toEqual([
    ['media', true],
    ['media', false],
  ])
  expect(mediaTasks[0]?.input.url?.startsWith('{fixture}/')).toBe(true)
  expect(mediaTasks[1]?.input.url?.startsWith('https://')).toBe(true)
})
