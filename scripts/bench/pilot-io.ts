// Image pilot I/O: one browser load per task (page text, image count, full-page
// screenshot), the reader call both arms share, and the gold-answer grader.
import { Effect, FileSystem, Redacted, Schema } from 'effect'
import * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientRequest from 'effect/http/HttpClientRequest'
import * as ChildProcess from 'effect/process/ChildProcess'
import { ChildProcessSpawner } from 'effect/process/ChildProcessSpawner'
import { parseHTML } from 'linkedom'
import { runBatch } from '../../src/lib/agentbrowser.ts'
import { htmlFromAgentBrowser } from '../../src/lib/driver.ts'
import { imagesFrom } from '../../src/lib/html-images.ts'
import type { RawImage } from '../../src/lib/jev/decisions/image-router.ts'

// One reader for both arms, so only the input differs between them.
const READER = 'google/gemini-2.5-flash'
const MAX_TEXT = 60_000
export const OUT = `${import.meta.dir}/../../bench/results/pilot-shots`

export interface Page {
  readonly text: string
  readonly images: ReadonlyArray<RawImage>
  readonly shot: string
}
export interface Task {
  readonly id: string
  readonly kind: string
  readonly url: string
  readonly question: string
  readonly gold: readonly string[]
}
export const EMPTY: Page = { text: '', images: [], shot: '' }

export const fetchPage = (t: Task) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const shot = `${OUT}/${t.id}.png`
    const res = yield* runBatch(
      [
        ['open', t.url],
        ['get', 'html', 'html'],
        ['wait', '4000'], // charts draw after load; the first run shot spinners
        ['screenshot', '--full', shot],
      ],
      `pilot-${t.id}`,
      90_000,
    )
    const html = yield* htmlFromAgentBrowser(res.stdout)
    const { document } = parseHTML(html || '<html></html>')
    const text = (document.body?.textContent ?? '').replace(/\s+/g, ' ').slice(0, MAX_TEXT)
    const ok = yield* fs.exists(shot)
    const data = ok ? Buffer.from(yield* fs.readFile(shot)).toString('base64') : ''
    const images = imagesFrom(document, t.url).map((i) => ({
      src: i.src,
      alt: i.alt,
      caption: i.caption,
      width: Number(i.width) || 0,
      height: Number(i.height) || 0,
      near: '',
    }))
    return { text, images, shot: data } satisfies Page
  })

const openrouterKey = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner
  const k = yield* spawner.string(
    ChildProcess.make`security find-generic-password -s openrouter-api-key -w`,
  )
  return Redacted.make(k.trim())
})

const Reply = Schema.fromJsonString(
  Schema.Struct({
    answer: Schema.optional(Schema.Unknown),
    confidence: Schema.optional(Schema.Unknown),
  }),
)
const READER_ASK =
  'Answer the question from the page. Reply as JSON {"answer": string, "confidence": number from 0 to 1}. Keep the answer short: a number, year, or few words.'

const readerBody = (t: Task, p: Page, withImage: boolean) => ({
  model: READER,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `${READER_ASK}\nQuestion: ${t.question}\nPage URL: ${t.url}\nPage text: ${p.text}`,
        },
        ...(withImage && p.shot
          ? [{ type: 'image_url', image_url: { url: `data:image/png;base64,${p.shot}` } }]
          : []),
      ],
    },
  ],
  response_format: { type: 'json_object' },
  usage: { include: true },
})

export const read = (t: Task, p: Page, withImage: boolean) =>
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const key = yield* openrouterKey
    const res = yield* http.execute(
      HttpClientRequest.post('https://openrouter.ai/api/v1/chat/completions').pipe(
        HttpClientRequest.bearerToken(Redacted.value(key)),
        HttpClientRequest.bodyJsonUnsafe(readerBody(t, p, withImage)),
      ),
    )
    const json = (yield* res.json) as {
      choices?: { message?: { content?: string } }[]
      usage?: { cost?: number }
    }
    const raw = (json.choices?.[0]?.message?.content ?? '{}')
      .replace(/^```(json)?|```$/g, '')
      .trim()
    const parsed = yield* Schema.decodeUnknownEffect(Reply)(raw).pipe(
      Effect.orElseSucceed(() => ({ answer: '', confidence: 0 })),
    )
    return {
      answer: String(parsed.answer ?? ''),
      confidence: Number(parsed.confidence ?? 0),
      usd: json.usage?.cost ?? 0,
    }
  })

const norm = (s: string) => s.toLowerCase().replace(/[,\s]+/g, '')
// Correct when the reply holds the gold answer or an alias, ignoring case, spaces, and commas.
export const graded = (answer: string, gold: readonly string[]) =>
  answer !== '' && gold.some((g) => norm(answer).includes(norm(g)))
