// Crawl's root page: the user's explicit target. robots.txt comes first: crawl has
// no override, so a disallowed root is never fetched, and `blocked` keeps the archive
// fallback off. An allowed root's redirects are followed freely and the crawl scope
// re-anchors on the FINAL host (apex to www).
import { Effect } from 'effect'
import { fetchRoot } from '../core/http.ts'
import { errMsg } from '../core/output.ts'
import { isRobotsBlock, robotsGate } from './robots-gate.ts'

type RootOutcome =
  | { ok: true; finalUrl: string; html: string }
  | { ok: false; reason: string; blocked?: true }

export const fetchRootPage = (url: string, timeoutMs?: number) =>
  robotsGate(url).pipe(
    Effect.andThen(fetchRoot(url, { timeoutMs })),
    Effect.match({
      onSuccess: ({ finalUrl, html }): RootOutcome => ({ ok: true, finalUrl, html }),
      onFailure: (err): RootOutcome =>
        isRobotsBlock(err)
          ? { ok: false, reason: `blocked: robots.txt disallows ${err.rule}`, blocked: true }
          : { ok: false, reason: errMsg(err) },
    }),
  )
