// Local document-to-Markdown through anydoc (MIT, Rust, no key, no network):
// Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, and text-based PDF,
// with the format read from the bytes. It never opts into anydoc's hosted
// OCR, so a scanned PDF fails with code 'needsOcr' and the caller picks the
// next parser (Tesseract). This is the one function the parse command and
// scrape's document route call. anydoc ships no Windows ARM64 binary, so the
// addon loads on first use and that platform fails with a typed error instead
// of crashing at import.
import { Data, Effect } from 'effect'

export const anydocUnsupportedPlatform = process.platform === 'win32' && process.arch === 'arm64'

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
  anydocUnsupportedPlatform
    ? Effect.fail(
        new DocumentConvertError({
          code: 'unsupportedPlatform',
          message:
            '@firecrawl/anydoc has no win32-arm64 binary, so documents cannot be converted on Windows ARM64',
        }),
      )
    : Effect.tryPromise({
        try: async () => (await import('@firecrawl/anydoc')).toMarkdownBytes(bytes),
        catch: toError,
      })
