// Local document-to-Markdown through anydoc (MIT, Rust, no key, no network):
// Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, and text-based PDF,
// with the format read from the bytes. It never opts into anydoc's hosted
// OCR, so a scanned PDF fails with code 'needsOcr' and the caller picks the
// next parser (Tesseract). This is the one function the parse command and
// scrape's document route call.
import { toMarkdownBytes } from '@firecrawl/anydoc'
import { Data, Effect } from 'effect'

class DocumentConvertError extends Data.TaggedError('DocumentConvertError')<{
  // anydoc's ConvertErrorCode ('unsupported', 'needsOcr', 'malformed', ...).
  code: string
  message: string
}> {}

const toError = (cause: unknown) =>
  new DocumentConvertError({
    code: (cause as { code?: unknown })?.code?.toString() ?? 'unknown',
    message: cause instanceof Error ? cause.message : String(cause),
  })

export const documentToMarkdown = (bytes: Uint8Array) =>
  Effect.tryPromise({ try: () => toMarkdownBytes(bytes), catch: toError })
