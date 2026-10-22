// A PDF read streams the body under a real byte cap: a body that lies about (or omits)
// content-length still stops at the cap instead of buffering whole.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { readPdf } from '../../src/workflows/scrape-fallback.ts'
import { startFixture } from '../_support/fixture.ts'

const CAP = 4 * 1024
const chunk = new Uint8Array(1024).fill(0x25)

test('pdf body over the cap with no content-length fails at the cap', () =>
  Effect.gen(function* () {
    const fx = yield* startFixture(() => ({
      '/big.pdf': () =>
        new Response(
          new ReadableStream({
            pull(c) {
              c.enqueue(chunk)
            },
          }),
          { headers: { 'content-type': 'application/pdf' } },
        ),
    }))
    const err = yield* Effect.flip(readPdf(`${fx.origin}/big.pdf`, CAP))
    expect(String(err)).toContain(`exceeded ${CAP} bytes`)
  }).pipe(Effect.scoped, Effect.runPromise))
