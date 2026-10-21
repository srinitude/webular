// Readability off the main thread: one HTML string in, its article text out.
import { Result } from 'effect'
import { errMsg } from '../core/output.ts'
import { htmlToArticle } from './html.ts'

declare const self: Worker

self.onmessage = (event: MessageEvent<string>) =>
  postMessage(
    Result.match(Result.try({ try: () => htmlToArticle(event.data).text, catch: errMsg }), {
      onSuccess: (text) => ({ text }),
      onFailure: (error) => ({ error }),
    }),
  )
