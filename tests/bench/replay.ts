// Shared fake for the peer adapter contracts: a Post that replays one recorded
// reply through the real schema decode and keeps every request it was sent.
import { Effect, Schema } from 'effect'
import { fail, type Post } from '../../scripts/bench/peers/peers.ts'

// body is absent for GET requests a test logs through the same list.
interface Req {
  url: string
  headers: Record<string, string>
  body?: object
}

export const recorded = (reply: unknown) => {
  const seen: Req[] = []
  const post: Post = (url, headers, body, schema) => {
    seen.push({ url, headers, body })
    return Schema.decodeUnknownEffect(schema)(reply).pipe(
      Effect.map((r) => ({ r, sentBytes: 7 })),
      Effect.mapError(fail),
    )
  }
  return { post, seen }
}
