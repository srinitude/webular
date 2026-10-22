// Collect a byte stream under a hard cap: the fold fails at the first chunk that
// crosses it, which interrupts the stream and cancels the body reader.
import { Effect, Stream } from 'effect'

export const collectCapped = <E>(
  stream: Stream.Stream<Uint8Array, E>,
  maxBytes: number,
  overflow: () => E,
): Effect.Effect<Uint8Array, E> =>
  Stream.runFoldEffect(
    stream,
    () => ({ total: 0, chunks: [] as Uint8Array[] }),
    (acc, chunk) =>
      acc.total + chunk.byteLength > maxBytes
        ? Effect.fail(overflow())
        : Effect.sync(() => {
            acc.chunks.push(chunk)
            return { total: acc.total + chunk.byteLength, chunks: acc.chunks }
          }),
  ).pipe(Effect.map(({ chunks }) => new Uint8Array(Buffer.concat(chunks))))
