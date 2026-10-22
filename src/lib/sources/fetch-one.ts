// One guarded source fetch for answer/research. A dead page (404, 410, 5xx,
// network failure, timeout) reads from the Internet Archive's closest capture,
// so one dead source does not drop out of an answer. A link found on a search
// result page is checked as a hop from a public page, so it reaches a private
// address only with WEBULAR_ALLOW_PRIVATE=1 (docs/commands.md#private-addresses);
// a URL the user typed is not.
import { Effect } from 'effect'
import { guardTarget } from '../../core/address-guard.ts'
import { fetchText } from '../../core/http.ts'
import { errMsg } from '../../core/output.ts'
import type { PageImage } from '../html-images.ts'
import { fetchTextObeyingRobots } from '../robots-gate.ts'
import type { SourceEntry } from '../sources.ts'
import { withArchiveCopy } from './archive-copy.ts'

type Outcome = { ok: true; entry: SourceEntry } | { ok: false; url: string; reason: string }

export const fetchOne = <R>(
  src: { title: string; url: string },
  opts: { timeoutMs: number; maxHtml: number; typed: boolean },
  parse: (
    html: string,
    base: string,
  ) => Effect.Effect<{ text: string; images: PageImage[]; published?: string }, unknown, R>,
) =>
  (opts.typed ? Effect.void : guardTarget(src.url, { url: src.url, originPrivate: false })).pipe(
    Effect.andThen(
      withArchiveCopy(
        src.url,
        fetchTextObeyingRobots(src.url, { timeoutMs: opts.timeoutMs }),
        (capture) => fetchText(capture, { timeoutMs: opts.timeoutMs }),
      ),
    ),
    Effect.flatMap(({ value: html }) => parse(html.slice(0, opts.maxHtml), src.url)),
    Effect.match({
      onSuccess: ({ text, images, published }): Outcome => ({
        ok: true,
        entry: { title: src.title, url: src.url, text, images, published },
      }),
      onFailure: (err): Outcome => ({ ok: false, url: src.url, reason: errMsg(err) }),
    }),
  )
