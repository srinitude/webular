// Readability off the main thread: one page's HTML and URL in, its article
// text and <img> records out.
import { Result } from 'effect'
import { errMsg } from '../core/output.ts'
import { textAndImages } from './html.ts'

declare const self: Worker

self.onmessage = (event: MessageEvent<{ html: string; base: string }>) =>
  postMessage(
    Result.match(
      Result.try({
        try: () => textAndImages(event.data.html, event.data.base),
        catch: errMsg,
      }),
      {
        onSuccess: (parsed) => ({ parsed }),
        onFailure: (error) => ({ error }),
      },
    ),
  )
